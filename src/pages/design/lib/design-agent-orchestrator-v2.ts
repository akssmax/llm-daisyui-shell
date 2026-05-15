import type { StreamChatResult } from "@/lib/llm-service"
import type { DesignAiResponse, DesignDocument } from "../types"
import { safePageElements } from "./safe-page-elements"
import { useDesignStore } from "../store/design-store"
import { applyPatchesToDocument } from "../store/patch-reducer"
import {
  DESIGN_MODEL_PARSE_FAILED_MESSAGE,
  DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE,
  extractJsonFromStream,
  tryParseDesignCandidate,
} from "./design-json-parser"
import {
  parseContentStructure,
  parseDesignSystem,
  parseIntentPlan,
  parseJsonObjectFromModel,
  parseTailwindThemeFromDesignSystem,
  type ContentStructure,
  type DesignTokenBundle,
  type IntentPlanPayload,
} from "./design-agent-schemas"
import { tokenPresetToBundle } from "./layout-intelligence/layout-catalog"
import {
  buildTailwindTokenBundle,
  normalizeAccentHue,
  normalizeThemeMode,
} from "./layout-intelligence/tailwind-theme-builder"
import { parseElementsOnlyCompose, assembleDocumentFromElements } from "./design-compose-assembler"
import {
  buildDesignSystemPhasePrompt,
  buildEnrichedOneShotComposePrompt,
  buildIntentPlanSystemPrompt,
  buildRepairPatchesSystemPrompt,
  buildV2ComposeFallbackPrompt,
  buildV2ContentStructurePrompt,
  buildV2CreateComposePrompt,
  buildV2EditComposePrompt,
  buildV2RecomposeComposePrompt,
} from "./design-phase-prompts"
import { deterministicRepairElements, validateDesignDocument } from "./design-validate"
import { runJsonPhase } from "./design-agent-orchestrator-helpers"
import type { DesignAgentPhaseTrace, RunDesignAgentTurnOptions } from "./design-agent-orchestrator"
import {
  routeDesignAgentOperation,
  isStructuredDocumentRequest,
  type DesignAgentOperation,
} from "./design-agent-router"
import {
  extractContentManifest,
  formatContentManifestForPrompt,
} from "./design-content-manifest"
import {
  applyCanvasSpecToDocument,
  resolveCanvasSpec,
  shouldApplyCanvasSpecToDocument,
} from "./layout-intelligence/canvas-spec"
import { inferTargetSlideIndex } from "./layout-intelligence/slide-utils"

const REPAIR_MAX = 1
const COMPOSE_MAX_TOKENS = 12_000

const EMPTY_AGENT_CANVAS_MESSAGE =
  "Design agent finished, but nothing was applied to the canvas (0 elements). Try a shorter brief or turn off Design agent."

function isLayoutEmpty(doc: DesignDocument): boolean {
  for (const p of doc.pages) {
    if (safePageElements(p).length > 0) return false
  }
  return true
}

function baseCanvasEmpty(doc: DesignDocument | null): boolean {
  return !doc || isLayoutEmpty(doc)
}

function resolveMergedToDocument(merged: DesignAiResponse, base: DesignDocument | null): DesignDocument | null {
  if (merged.kind === "document") return merged.document
  if (merged.kind === "patches" && base) return applyPatchesToDocument(base, merged.patches)
  return null
}

function mergeRepair(first: DesignAiResponse, repair: DesignAiResponse | null): DesignAiResponse {
  if (!repair || repair.kind !== "patches") return first
  if (first.kind === "patches") {
    return {
      kind: "patches",
      patches: [...first.patches, ...repair.patches],
      ...(first.assistantNote ? { assistantNote: first.assistantNote } : {}),
    }
  }
  if (first.kind === "document") {
    const doc = applyPatchesToDocument(first.document, repair.patches)
    return {
      kind: "document",
      document: doc,
      ...(first.assistantNote ? { assistantNote: first.assistantNote } : {}),
    }
  }
  return first
}

function isTruncatedOutput(stream: StreamChatResult, parsed: DesignAiResponse): boolean {
  if (stream.finishReason === "length" || stream.completionStatus === "max_tokens_reached") return true
  return parsed.kind === "message" && parsed.text === DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE
}

function isParseFailure(parsed: DesignAiResponse): boolean {
  return parsed.kind === "message" && parsed.text === DESIGN_MODEL_PARSE_FAILED_MESSAGE
}

function salvageParse(raw: string, parsed: DesignAiResponse): DesignAiResponse {
  if (parsed.kind !== "message") return parsed
  if (
    !parsed.text.includes("Could not read") &&
    !parsed.text.includes("cut off") &&
    parsed.text !== DESIGN_MODEL_PARSE_FAILED_MESSAGE &&
    parsed.text !== DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE
  ) {
    return parsed
  }
  const retry = tryParseDesignCandidate(raw)
  return retry ?? parsed
}

function parseElementsOnlyFallback(
  raw: string,
  intentPlan: IntentPlanPayload,
  tokens: DesignTokenBundle,
): DesignAiResponse | null {
  const elements = parseElementsOnlyCompose(raw)
  if (!elements || elements.length === 0) return null
  const doc = assembleDocumentFromElements(elements, {
    intentPlan,
    tokens,
    title: intentPlan.intent.designType,
  })
  return { kind: "document", document: doc }
}

function composeErrorSummary(stream: StreamChatResult, parsed: DesignAiResponse): string {
  if (!stream.emittedTokens && stream.completionStatus === "completed") return "Empty model response"
  if (isTruncatedOutput(stream, parsed)) return "Output truncated — JSON incomplete"
  if (isParseFailure(parsed)) return "Invalid JSON — could not parse design reply"
  if (parsed.kind === "message") return "Parse failed — wrong response shape"
  return "Compose parse failed"
}

const OPERATION_LABELS: Record<DesignAgentOperation, string> = {
  design_create: "Create design",
  design_edit: "Edit design",
  design_recompose_layout: "Remix layout",
}

export async function runDesignAgentTurnV2(
  opts: RunDesignAgentTurnOptions & { forcedOperation?: DesignAgentOperation },
): Promise<{
  response: DesignAiResponse
  phases: DesignAgentPhaseTrace[]
  debugBundle: Record<string, unknown>
}> {
  const store = useDesignStore.getState()
  const model = opts.model ?? store.designChatModel
  const document = store.document
  const phases: DesignAgentPhaseTrace[] = []
  const debugBundle: Record<string, unknown> = {}
  const userContent = opts.userMessage.trim()
  const pageCount = document?.pages.length ?? 0
  const targetSlideIndex = inferTargetSlideIndex(userContent, pageCount)

  const operation = routeDesignAgentOperation({
    userMessage: userContent,
    document,
    forcedOperation: opts.forcedOperation,
  })
  debugBundle.operation = operation

  const pushPhase = (t: DesignAgentPhaseTrace) => {
    phases.push(t)
    opts.onPhaseComplete?.(t)
  }

  const run = async (args: Parameters<typeof runJsonPhase>[0]) => {
    const running: DesignAgentPhaseTrace = {
      id: args.phaseId,
      label: args.label,
      summary: "",
      state: "running",
    }
    pushPhase(running)
    return runJsonPhase({
      ...args,
      onPhaseEnd: (t) => {
        if (phases.length > 0) phases[phases.length - 1] = t
        opts.onPhaseComplete?.(t)
      },
    })
  }

  pushPhase({
    id: "route_operation",
    label: "Route",
    summary: OPERATION_LABELS[operation],
    state: "complete",
  })

  const ipRaw = await run({
    phaseId: "intent_plan",
    label: "Intent & canvas plan",
    systemPrompt: buildIntentPlanSystemPrompt(userContent, store.canvasPresetMode ?? "auto"),
    userContent,
    model,
    maxTokens: 1400,
    signal: opts.signal,
    attachments: opts.attachments,
    onToken: opts.onToken,
    onAgentPhase: opts.onAgentPhase,
    onPhaseBuffer: opts.onPhaseBuffer,
  })
  debugBundle.intentPlanRaw = ipRaw.raw
  const intentPlan = ipRaw.raw ? parseIntentPlan(parseJsonObjectFromModel(ipRaw.raw) ?? {}) : null
  if (!intentPlan) {
    const err: DesignAgentPhaseTrace = { ...ipRaw.trace, state: "error", summary: "Invalid intent/plan JSON" }
    if (phases.length > 0) phases[phases.length - 1] = err
    opts.onPhaseComplete?.(err)
    return {
      response: { kind: "message", text: "Design agent could not parse intent/plan. Try a simpler prompt." },
      phases,
      debugBundle,
    }
  }

  const canvasSpec = resolveCanvasSpec({
    userMessage: userContent,
    intent: intentPlan,
    presetKey: store.canvasPresetMode ?? "auto",
  })
  debugBundle.canvasSpec = canvasSpec

  const dsRaw = await run({
    phaseId: "design_system",
    label: "Design tokens",
    systemPrompt: buildDesignSystemPhasePrompt(userContent, intentPlan),
    userContent: `Apply tokens for: ${userContent}`,
    model,
    maxTokens: 1600,
    signal: opts.signal,
    onToken: opts.onToken,
    onAgentPhase: opts.onAgentPhase,
    onPhaseBuffer: opts.onPhaseBuffer,
  })
  debugBundle.designSystemRaw = dsRaw.raw
  const dsParsed = parseJsonObjectFromModel(dsRaw.raw)
  let tokens: DesignTokenBundle | null = dsParsed ? parseDesignSystem(dsParsed) : null
  if (!tokens && dsParsed) {
    const themeSel = parseTailwindThemeFromDesignSystem(dsParsed)
    const accentHue = normalizeAccentHue(themeSel?.accentHue)
    const mode = normalizeThemeMode(themeSel?.mode)
    const tw = buildTailwindTokenBundle({ accentHue, mode })
    tokens = tokenPresetToBundle(tw) as DesignTokenBundle
    debugBundle.tailwindTheme = { accentHue, mode }
  }
  if (!tokens) {
    const err: DesignAgentPhaseTrace = { ...dsRaw.trace, state: "error", summary: "Invalid design tokens" }
    if (phases.length > 0) phases[phases.length - 1] = err
    opts.onPhaseComplete?.(err)
    return {
      response: { kind: "message", text: "Design agent could not parse design tokens." },
      phases,
      debugBundle,
    }
  }

  let contentStructure: ContentStructure | null = null
  if (
    operation !== "design_recompose_layout" &&
    isStructuredDocumentRequest(userContent, intentPlan.intent.designType)
  ) {
    const csRaw = await run({
      phaseId: "content_structure",
      label: "Content structure",
      systemPrompt: buildV2ContentStructurePrompt(userContent, intentPlan),
      userContent,
      model,
      maxTokens: 2400,
      signal: opts.signal,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
    })
    debugBundle.contentStructureRaw = csRaw.raw
    const csObj = parseJsonObjectFromModel(csRaw.raw)
    contentStructure = csObj ? parseContentStructure(csObj) : null
    debugBundle.contentStructure = contentStructure
  }

  let contentManifestJson: string | null = null
  if (operation === "design_recompose_layout" && document) {
    const manifest = extractContentManifest(document)
    contentManifestJson = formatContentManifestForPrompt(manifest)
    pushPhase({
      id: "extract_content",
      label: "Extract content",
      summary: `${manifest.elements.length} elements`,
      state: "complete",
    })
    debugBundle.contentManifest = manifest
  }

  const composeSystemPrompt = (() => {
    if (operation === "design_recompose_layout" && contentManifestJson) {
      return buildV2RecomposeComposePrompt(document, intentPlan, tokens, canvasSpec, contentManifestJson)
    }
    if (operation === "design_create") {
      return buildV2CreateComposePrompt(document, intentPlan, tokens, canvasSpec, contentStructure, {
        targetSlideIndex,
      })
    }
    return buildV2EditComposePrompt(document, intentPlan, tokens, canvasSpec, { targetSlideIndex })
  })()

  const parseComposeRaw = (raw: string, stream: StreamChatResult): DesignAiResponse => {
    let parsed = extractJsonFromStream(raw)
    parsed = salvageParse(raw, parsed)
    if (parsed.kind === "message") {
      const alt = parseElementsOnlyFallback(raw, intentPlan, tokens)
      if (alt) return alt
    }
    if (isTruncatedOutput(stream, parsed) && parsed.kind === "message") {
      const alt = parseElementsOnlyFallback(raw, intentPlan, tokens)
      if (alt) return alt
    }
    return parsed
  }

  const composeRaw = await run({
    phaseId: "compose_document",
    label: operation === "design_recompose_layout" ? "Recompose layout" : "Compose canvas",
    systemPrompt: composeSystemPrompt,
    userContent,
    model,
    maxTokens: COMPOSE_MAX_TOKENS,
    signal: opts.signal,
    attachments: opts.attachments,
    onToken: opts.onToken,
    onAgentPhase: opts.onAgentPhase,
    onPhaseBuffer: opts.onPhaseBuffer,
  })
  debugBundle.composeRaw = composeRaw.raw
  let composed = parseComposeRaw(composeRaw.raw, composeRaw.stream)
  let lastComposeStream = composeRaw.stream

  const runComposeRetry = async (label: string, systemPrompt: string, debugKey: string) => {
    debugBundle.composeFallbackTriggered = true
    const retry = await run({
      phaseId: "compose_document",
      label,
      systemPrompt,
      userContent,
      model,
      maxTokens: COMPOSE_MAX_TOKENS,
      signal: opts.signal,
      attachments: opts.attachments,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
    })
    debugBundle[debugKey] = retry.raw
    lastComposeStream = retry.stream
    return parseComposeRaw(retry.raw, retry.stream)
  }

  if (composed.kind === "message" && isTruncatedOutput(composeRaw.stream, composed)) {
    const truncatedRetry = await runComposeRetry(
      "Compose (truncation retry)",
      buildV2ComposeFallbackPrompt(document, intentPlan, tokens, canvasSpec),
      "composeTruncationRetryRaw",
    )
    if (truncatedRetry.kind !== "message") composed = truncatedRetry
  }

  if (composed.kind === "patches" && !document) {
    const docRetry = await runComposeRetry(
      "Compose (retry)",
      buildV2ComposeFallbackPrompt(null, intentPlan, tokens, canvasSpec),
      "composeFallbackRaw",
    )
    if (docRetry.kind !== "message") composed = docRetry
  }

  if (composed.kind === "message") {
    const fallbackResult = await runComposeRetry(
      "Compose (retry)",
      buildV2ComposeFallbackPrompt(document, intentPlan, tokens, canvasSpec),
      "composeFallbackRaw",
    )
    if (fallbackResult.kind !== "message") composed = fallbackResult
  }

  if (composed.kind === "message") {
    const freeformLayout = {
      regions: [{ id: "canvas", role: "freeform", relativeRect: { x: 0, y: 0, w: 1, h: 1 } }],
    }
    const oneShotRetry = await runComposeRetry(
      "Compose (one-shot)",
      buildEnrichedOneShotComposePrompt(document, { intentPlan, tokens, layout: freeformLayout }, userContent),
      "composeOneShotRaw",
    )
    if (oneShotRetry.kind !== "message") composed = oneShotRetry
  }

  if (composed.kind === "message") {
    const err: DesignAgentPhaseTrace = {
      ...composeRaw.trace,
      state: "error",
      summary: composeErrorSummary(lastComposeStream, composed),
    }
    if (phases.length > 0) phases[phases.length - 1] = err
    opts.onPhaseComplete?.(err)
    const userText =
      composed.text === DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE
        ? composed.text
        : composed.text === DESIGN_MODEL_PARSE_FAILED_MESSAGE
          ? composed.text
          : `Design agent could not parse the compose step (${err.summary}). Try a shorter brief or turn off Design agent.`
    return { response: { kind: "message", text: userText }, phases, debugBundle }
  }

  let workingDoc: DesignDocument | null = document
  if (composed.kind === "document") {
    workingDoc = composed.document
  } else if (composed.kind === "patches" && document) {
    workingDoc = applyPatchesToDocument(document, composed.patches)
  }

  if (!workingDoc) {
    return { response: composed, phases, debugBundle }
  }

  const assistantNote =
    composed.kind !== "message" && composed.assistantNote ? composed.assistantNote : undefined

  if (shouldApplyCanvasSpecToDocument(workingDoc, canvasSpec, userContent, intentPlan)) {
    workingDoc = applyCanvasSpecToDocument(workingDoc, canvasSpec)
    debugBundle.canvasSpecApplied = true
    pushPhase({
      id: "canvas_select",
      label: "Canvas size",
      summary: `${canvasSpec.width}×${canvasSpec.height} (${canvasSpec.label})`,
      state: "complete",
    })
  }

  const margin = intentPlan.plan.grid.safeMargin
  const detRepaired: DesignDocument = {
    ...workingDoc,
    pages: workingDoc.pages.map((p) => ({
      ...p,
      elements: deterministicRepairElements(p.elements ?? [], { width: p.width, height: p.height }),
    })),
  }
  workingDoc = detRepaired
  debugBundle.deterministicRepairApplied = true

  const canvasWasApplied = Boolean(debugBundle.canvasSpecApplied)
  let merged: DesignAiResponse =
    composed.kind === "document" || canvasWasApplied
      ? {
          kind: "document",
          document: detRepaired,
          ...(assistantNote ? { assistantNote } : {}),
        }
      : composed

  let validation = validateDesignDocument(workingDoc, { safeMargin: margin })
  debugBundle.validationPass0 = validation
  let repairRound = 0

  while (!validation.valid && repairRound < REPAIR_MAX) {
    repairRound += 1
    const repairRaw = await run({
      phaseId: "repair",
      label: `Repair (${repairRound})`,
      systemPrompt: buildRepairPatchesSystemPrompt(workingDoc, validation.issues),
      userContent: "Emit minimal patches to fix the issues.",
      model,
      maxTokens: 4000,
      signal: opts.signal,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
    })
    debugBundle[`repairRaw${repairRound}`] = repairRaw.raw
    const repaired = tryParseDesignCandidate(repairRaw.raw)
    if (!repaired || repaired.kind !== "patches") {
      const err: DesignAgentPhaseTrace = { ...repairRaw.trace, state: "error", summary: "Repair parse failed" }
      if (phases.length > 0) phases[phases.length - 1] = err
      opts.onPhaseComplete?.(err)
      break
    }
    merged = mergeRepair(merged, repaired)
    if (merged.kind === "document") {
      workingDoc = merged.document
    } else if (merged.kind === "patches") {
      const patchBase =
        merged.kind === "patches" && workingDoc
          ? applyPatchesToDocument(workingDoc, merged.patches)
          : workingDoc
      if (patchBase) workingDoc = patchBase
    }
    validation = validateDesignDocument(workingDoc, { safeMargin: margin })
    debugBundle[`validationAfterRepair${repairRound}`] = validation
    if (validation.valid) break
  }

  if (debugBundle.canvasSpecApplied && workingDoc) {
    merged = {
      kind: "document",
      document: workingDoc,
      ...(assistantNote ? { assistantNote } : {}),
    }
  }

  const finalized = resolveMergedToDocument(merged, document)
  if (merged.kind !== "message" && finalized && baseCanvasEmpty(document) && isLayoutEmpty(finalized)) {
    const composeIdx = phases.map((p) => p.id).lastIndexOf("compose_document")
    if (composeIdx !== -1) {
      const next: DesignAgentPhaseTrace = {
        ...phases[composeIdx]!,
        state: "error",
        summary: "Empty canvas (0 elements applied)",
      }
      phases[composeIdx] = next
      opts.onPhaseComplete?.(next)
    }
    return {
      response: { kind: "message", text: EMPTY_AGENT_CANVAS_MESSAGE },
      phases,
      debugBundle: { ...debugBundle, agentEmptyCanvas: true },
    }
  }

  return { response: merged, phases, debugBundle: { ...debugBundle, agentV2: true } }
}
