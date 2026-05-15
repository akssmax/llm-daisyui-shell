import type { AgentPhaseSsePayload, StreamChatResult } from "@/lib/llm-service"
import type { MistralModel } from "@/lib/llm-types"
import type { FileUIPart } from "ai"
import type { DesignAiResponse, DesignDocument } from "../types"
import { safePageElements } from "../lib/safe-page-elements"
import { useDesignStore } from "../store/design-store"
import { applyPatchesToDocument } from "../store/patch-reducer"
import {
  DESIGN_MODEL_PARSE_FAILED_MESSAGE,
  DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE,
  extractJsonFromStream,
  tryParseDesignCandidate,
} from "./design-json-parser"
import {
  parseDesignSystem,
  parseIntentPlan,
  parseJsonObjectFromModel,
  parseLayoutTree,
  parseTailwindThemeFromDesignSystem,
  type DesignTokenBundle,
  type IntentPlanPayload,
  type LayoutTree,
} from "./design-agent-schemas"
import { tokenPresetToBundle } from "./layout-intelligence/layout-catalog"
import {
  buildTailwindTokenBundle,
  normalizeAccentHue,
  normalizeThemeMode,
} from "./layout-intelligence/tailwind-theme-builder"
import {
  assembleDocumentFromElements,
  assembleDocumentFromRegionContents,
  parseElementsOnlyCompose,
  parseRegionContentsCompose,
} from "./design-compose-assembler"
import {
  buildComposeElementsOnlyPrompt,
  buildComposeFallbackPrompt,
  buildComposeHybridPrompt,
  buildComposePhaseSystemPrompt,
  buildComposeTruncationRetryPrompt,
  buildDesignSystemPhasePrompt,
  buildEnrichedOneShotComposePrompt,
  buildIntentPlanSystemPrompt,
  buildLayoutTreePhasePrompt,
  buildRepairPatchesSystemPrompt,
} from "./design-phase-prompts"
import { deterministicRepairElements, validateDesignDocument } from "./design-validate"
import { runJsonPhase } from "./design-agent-orchestrator-helpers"
import { runIntelligenceAgentTurn } from "./layout-intelligence/design-intelligence-orchestrator"
import {
  inferTargetSlideIndex,
  shouldRunIntelligencePipeline,
} from "./layout-intelligence/slide-utils"

export type DesignAgentPhaseId =
  | "intent_plan"
  | "layout_retrieval"
  | "layout_select"
  | "layout_tree"
  | "design_system"
  | "content_structure"
  | "content_map"
  | "canvas_select"
  | "region_bind"
  | "assemble"
  | "validate"
  | "refine_engine"
  | "refine_content"
  | "critic"
  | "auto_fix"
  | "finalize"
  | "compose"
  | "repair"

export type DesignAgentPhaseTrace = {
  id: DesignAgentPhaseId
  label: string
  summary: string
  state: "running" | "complete" | "error"
  rawJson?: string
}

export type RunDesignAgentTurnOptions = {
  userMessage: string
  attachments?: FileUIPart[]
  signal?: AbortSignal
  model?: MistralModel
  onToken?: (token: string) => void
  onAgentPhase?: (payload: AgentPhaseSsePayload) => void
  onPhaseComplete?: (trace: DesignAgentPhaseTrace) => void
  onPhaseBuffer?: (phaseId: DesignAgentPhaseId, buffer: string) => void
}

const REPAIR_MAX = 1
const COMPOSE_MAX_TOKENS = 12_000

const EMPTY_AGENT_CANVAS_MESSAGE =
  "Design agent finished, but nothing was applied to the canvas (0 elements). The compose step often returned patches while no document existed, or patch ops used the wrong pageId so they were ignored. Turn off Design agent for a single-shot generation, or try again with a shorter brief."

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

function parseComposeAlternates(
  raw: string,
  bundle: { intentPlan: IntentPlanPayload; tokens: DesignTokenBundle; layout: LayoutTree },
): DesignAiResponse | null {
  const elements = parseElementsOnlyCompose(raw)
  if (elements && elements.length > 0) {
    const doc = assembleDocumentFromElements(elements, {
      intentPlan: bundle.intentPlan,
      tokens: bundle.tokens,
      title: bundle.intentPlan.intent.designType,
    })
    return { kind: "document", document: doc }
  }
  const regionContents = parseRegionContentsCompose(raw)
  if (regionContents && regionContents.length > 0) {
    const doc = assembleDocumentFromRegionContents(bundle.layout, regionContents, {
      intentPlan: bundle.intentPlan,
      tokens: bundle.tokens,
      title: bundle.intentPlan.intent.designType,
    })
    return { kind: "document", document: doc }
  }
  return null
}

function composeErrorSummary(
  stream: StreamChatResult,
  parsed: DesignAiResponse,
): string {
  if (!stream.emittedTokens && stream.completionStatus === "completed") return "Empty model response"
  if (isTruncatedOutput(stream, parsed)) return "Output truncated — JSON incomplete"
  if (isParseFailure(parsed)) return "Invalid JSON — could not parse design reply"
  if (parsed.kind === "message") return "Parse failed — wrong response shape"
  return "Compose parse failed"
}

export async function runDesignAgentTurn(opts: RunDesignAgentTurnOptions): Promise<{
  response: DesignAiResponse
  phases: DesignAgentPhaseTrace[]
  debugBundle: Record<string, unknown>
  variants?: import("./layout-intelligence/types").DesignVariant[]
}> {
  const store = useDesignStore.getState()
  const model = opts.model ?? store.designChatModel
  const document = store.document
  const phases: DesignAgentPhaseTrace[] = []
  const debugBundle: Record<string, unknown> = {}

  const pushPhase = (t: DesignAgentPhaseTrace) => {
    phases.push(t)
    opts.onPhaseComplete?.(t)
  }

  const userContent = opts.userMessage.trim()

  const pageCount = document?.pages.length ?? 0
  const targetSlideIndex = inferTargetSlideIndex(userContent, pageCount)

  // Intelligence pipeline: empty canvas, new carousels, add slides, or targeted slide edit
  if (shouldRunIntelligencePipeline(userContent, baseCanvasEmpty(document), pageCount)) {
    const intel = await runIntelligenceAgentTurn(opts)
    return {
      response: intel.response,
      phases: intel.phases,
      debugBundle: { ...intel.debugBundle, intelligencePipeline: true },
      variants: intel.variants,
    }
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

  const ipRaw = await run({
    phaseId: "intent_plan",
    label: "Intent & layout plan",
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
  const ipObj = parseJsonObjectFromModel(ipRaw.raw)
  const intentPlan = ipObj ? parseIntentPlan(ipObj) : null
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
    const err: DesignAgentPhaseTrace = { ...dsRaw.trace, state: "error", summary: "Invalid designSystem JSON" }
    if (phases.length > 0) phases[phases.length - 1] = err
    opts.onPhaseComplete?.(err)
    return {
      response: { kind: "message", text: "Design agent could not parse design tokens." },
      phases,
      debugBundle,
    }
  }

  const ltRaw = await run({
    phaseId: "layout_tree",
    label: "Layout regions",
    systemPrompt: buildLayoutTreePhasePrompt(userContent, intentPlan, tokens),
    userContent,
    model,
    maxTokens: 1400,
    signal: opts.signal,
    onToken: opts.onToken,
    onAgentPhase: opts.onAgentPhase,
    onPhaseBuffer: opts.onPhaseBuffer,
  })
  debugBundle.layoutTreeRaw = ltRaw.raw
  const ltObj = parseJsonObjectFromModel(ltRaw.raw)
  const layout = ltObj ? parseLayoutTree(ltObj) : null
  if (!layout) {
    const err: DesignAgentPhaseTrace = { ...ltRaw.trace, state: "error", summary: "Invalid layout JSON" }
    if (phases.length > 0) phases[phases.length - 1] = err
    opts.onPhaseComplete?.(err)
    return {
      response: { kind: "message", text: "Design agent could not parse layout regions." },
      phases,
      debugBundle,
    }
  }

  const bundle = { intentPlan, tokens, layout }
  const composeAttachments = opts.attachments

  const parseComposeRaw = (raw: string, stream: StreamChatResult): DesignAiResponse => {
    let parsed = extractJsonFromStream(raw)
    parsed = salvageParse(raw, parsed)
    if (parsed.kind === "message") {
      const alt = parseComposeAlternates(raw, bundle)
      if (alt) return alt
    }
    if (isTruncatedOutput(stream, parsed) && parsed.kind === "message") {
      const alt = parseComposeAlternates(raw, bundle)
      if (alt) return alt
    }
    return parsed
  }

  const composeRaw = await run({
    phaseId: "compose",
    label: "Compose canvas",
    systemPrompt: buildComposePhaseSystemPrompt(document, bundle, { targetSlideIndex }),
    userContent,
    model,
    maxTokens: COMPOSE_MAX_TOKENS,
    signal: opts.signal,
    attachments: composeAttachments,
    onToken: opts.onToken,
    onAgentPhase: opts.onAgentPhase,
    onPhaseBuffer: opts.onPhaseBuffer,
  })
  debugBundle.composeRaw = composeRaw.raw
  debugBundle.composeFinishReason = composeRaw.stream.finishReason
  let composed = parseComposeRaw(composeRaw.raw, composeRaw.stream)
  let lastComposeStream = composeRaw.stream

  const runComposeRetry = async (label: string, systemPrompt: string, debugKey: string) => {
    debugBundle.composeFallbackTriggered = true
    const retry = await run({
      phaseId: "compose",
      label,
      systemPrompt,
      userContent,
      model,
      maxTokens: COMPOSE_MAX_TOKENS,
      signal: opts.signal,
      attachments: composeAttachments,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
    })
    debugBundle[debugKey] = retry.raw
    lastComposeStream = retry.stream
    return parseComposeRaw(retry.raw, retry.stream)
  }

  // Truncation-aware retry: smaller input, same output budget.
  if (composed.kind === "message" && isTruncatedOutput(composeRaw.stream, composed)) {
    const truncatedRetry = await runComposeRetry(
      "Compose canvas (truncation retry)",
      buildComposeTruncationRetryPrompt(document, bundle, { targetSlideIndex }),
      "composeTruncationRetryRaw",
    )
    if (truncatedRetry.kind !== "message") composed = truncatedRetry
  }

  // Patches without base document → force document output.
  if (composed.kind === "patches" && !document) {
    const docRetry = await runComposeRetry(
      "Compose canvas (retry)",
      buildComposeFallbackPrompt(null, intentPlan, tokens, layout),
      "composeFallbackRaw",
    )
    if (docRetry.kind !== "message") composed = docRetry
  }

  // Generic parse failure → improved fallback with layout + pageId.
  if (composed.kind === "message") {
    const fallbackResult = await runComposeRetry(
      "Compose canvas (retry)",
      buildComposeFallbackPrompt(document, intentPlan, tokens, layout),
      "composeFallbackRaw",
    )
    if (fallbackResult.kind !== "message") composed = fallbackResult
  }

  // Elements-only compose (smaller JSON).
  if (composed.kind === "message") {
    const elementsRetry = await runComposeRetry(
      "Compose canvas (elements)",
      buildComposeElementsOnlyPrompt(bundle),
      "composeElementsOnlyRaw",
    )
    if (elementsRetry.kind !== "message") composed = elementsRetry
  }

  // Hybrid: region text only, positions from layout tree.
  if (composed.kind === "message" && layout.regions.length > 0) {
    const hybridRetry = await runComposeRetry(
      "Compose canvas (regions)",
      buildComposeHybridPrompt(bundle),
      "composeHybridRaw",
    )
    if (hybridRetry.kind !== "message") composed = hybridRetry
  }

  // Last resort: enriched one-shot prompt (proven path).
  if (composed.kind === "message") {
    const oneShotRetry = await runComposeRetry(
      "Compose canvas (one-shot)",
      buildEnrichedOneShotComposePrompt(document, bundle, userContent),
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
    const afterPatches = applyPatchesToDocument(document, composed.patches)
    const totalElsAfter = afterPatches.pages.reduce((s, p) => s + (p.elements?.length ?? 0), 0)
    const totalElsBefore = document.pages.reduce((s, p) => s + (p.elements?.length ?? 0), 0)
    if (totalElsAfter === totalElsBefore) {
      const fbResult = await runComposeRetry(
        "Compose canvas (retry)",
        buildComposeFallbackPrompt(document, intentPlan, tokens, layout),
        "composeNoOpPatchesRaw",
      )
      if (fbResult.kind === "document") {
        workingDoc = fbResult.document
        composed = fbResult
      } else if (fbResult.kind === "patches") {
        workingDoc = applyPatchesToDocument(document, fbResult.patches)
        composed = fbResult
      } else {
        workingDoc = afterPatches
      }
    } else {
      workingDoc = afterPatches
    }
  }

  if (!workingDoc) {
    return { response: composed, phases, debugBundle }
  }

  const margin = intentPlan.plan.grid.safeMargin

  // Apply deterministic fixes (snap to 8px grid, clamp min font size) before any LLM repair.
  // This eliminates grid/text-size issues without a costly round-trip.
  const detRepaired: DesignDocument = {
    ...workingDoc,
    pages: workingDoc.pages.map((p) => ({
      ...p,
      elements: deterministicRepairElements(p.elements ?? [], { width: p.width, height: p.height }),
    })),
  }
  workingDoc = detRepaired
  debugBundle.deterministicRepairApplied = true

  let merged: DesignAiResponse = composed.kind === "document"
    ? { kind: "document", document: detRepaired, ...(composed.assistantNote ? { assistantNote: composed.assistantNote } : {}) }
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
    } else if (merged.kind === "patches" && document) {
      workingDoc = applyPatchesToDocument(document, merged.patches)
    } else if (merged.kind === "patches" && workingDoc) {
      workingDoc = applyPatchesToDocument(workingDoc, repaired.patches)
    }
    validation = validateDesignDocument(workingDoc, { safeMargin: margin })
    debugBundle[`validationAfterRepair${repairRound}`] = validation
    if (validation.valid) break
  }

  const finalized = resolveMergedToDocument(merged, document)
  if (
    merged.kind !== "message" &&
    finalized &&
    baseCanvasEmpty(document) &&
    isLayoutEmpty(finalized)
  ) {
    const composeIdx = phases.map((p) => p.id).lastIndexOf("compose")
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

  return { response: merged, phases, debugBundle }
}
