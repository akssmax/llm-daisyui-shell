import { streamChat, type AgentPhaseSsePayload } from "@/lib/llm-service"
import type { MistralModel } from "@/lib/llm-types"
import type { FileUIPart } from "ai"
import type { DesignAiResponse, DesignDocument } from "../types"
import { safePageElements } from "../lib/safe-page-elements"
import { useDesignStore } from "../store/design-store"
import { applyPatchesToDocument } from "../store/patch-reducer"
import { extractJsonFromStream, tryParseDesignCandidate } from "./design-json-parser"
import {
  parseDesignSystem,
  parseIntentPlan,
  parseJsonObjectFromModel,
  parseLayoutTree,
} from "./design-agent-schemas"
import {
  buildComposeFallbackPrompt,
  buildComposePhaseSystemPrompt,
  buildDesignSystemPhasePrompt,
  buildIntentPlanSystemPrompt,
  buildLayoutTreePhasePrompt,
  buildRepairPatchesSystemPrompt,
} from "./design-phase-prompts"
import { deterministicRepairElements, validateDesignDocument } from "./design-validate"

export type DesignAgentPhaseId = "intent_plan" | "design_system" | "layout_tree" | "compose" | "repair"

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

function summarizeJsonKeys(raw: string): string {
  const obj = parseJsonObjectFromModel(raw)
  if (!obj || typeof obj !== "object") return "Structured response"
  const keys = Object.keys(obj as Record<string, unknown>).slice(0, 8)
  return keys.length ? keys.join(", ") : "OK"
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

async function runJsonPhase(options: {
  phaseId: DesignAgentPhaseId
  label: string
  systemPrompt: string
  userContent: string
  model: MistralModel
  maxTokens: number
  signal?: AbortSignal
  attachments?: FileUIPart[]
  onToken?: (t: string) => void
  onAgentPhase?: (p: AgentPhaseSsePayload) => void
  onPhaseBuffer?: (phaseId: DesignAgentPhaseId, buffer: string) => void
  onPhaseEnd?: (t: DesignAgentPhaseTrace) => void
}): Promise<{ raw: string; trace: DesignAgentPhaseTrace }> {
  const { phaseId, label, systemPrompt, userContent, model, maxTokens, signal, attachments, onToken, onAgentPhase, onPhaseBuffer, onPhaseEnd } = options
  const trace: DesignAgentPhaseTrace = { id: phaseId, label, summary: "", state: "running" }
  let buffer = ""
  await streamChat({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    temperature: 0.25,
    maxTokens,
    responseFormat: "json_object",
    designAgentPhase: phaseId,
    designAgentPhaseLabel: label,
    signal,
    onToken: (t) => {
      buffer += t
      onToken?.(t)
      onPhaseBuffer?.(phaseId, buffer)
    },
    onAgentPhase,
  })
  if (!buffer.trim()) {
    const failed: DesignAgentPhaseTrace = {
      ...trace,
      state: "error",
      summary: "Empty model response (no streamed text)",
      rawJson: "",
    }
    onPhaseEnd?.(failed)
    return { raw: "", trace: failed }
  }
  const done: DesignAgentPhaseTrace = {
    ...trace,
    state: "complete",
    summary: summarizeJsonKeys(buffer),
    rawJson: buffer.trim().length > 120_000 ? `${buffer.slice(0, 120_000)}\n…[truncated]` : buffer,
  }
  onPhaseEnd?.(done)
  return { raw: buffer, trace: done }
}

export async function runDesignAgentTurn(opts: RunDesignAgentTurnOptions): Promise<{
  response: DesignAiResponse
  phases: DesignAgentPhaseTrace[]
  debugBundle: Record<string, unknown>
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
    systemPrompt: buildIntentPlanSystemPrompt(userContent),
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
  const tokens = dsParsed ? parseDesignSystem(dsParsed) : null
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

  const composeRaw = await run({
    phaseId: "compose",
    label: "Compose canvas",
    systemPrompt: buildComposePhaseSystemPrompt(document, { intentPlan, tokens, layout }),
    userContent,
    model,
    maxTokens: 10_000,
    signal: opts.signal,
    attachments: opts.attachments,
    onToken: opts.onToken,
    onAgentPhase: opts.onAgentPhase,
    onPhaseBuffer: opts.onPhaseBuffer,
  })
  debugBundle.composeRaw = composeRaw.raw
  let composed = extractJsonFromStream(composeRaw.raw)
  if (
    composed.kind === "message" &&
    (composed.text.includes("Could not read") || composed.text.includes("cut off"))
  ) {
    const retry = tryParseDesignCandidate(composeRaw.raw)
    if (retry) composed = retry
  }

  // Fallback: first compose attempt failed to parse — retry with a minimal prompt that strips
  // the heavy document snapshot and bundle details so a small model can produce clean JSON.
  if (composed.kind === "message") {
    debugBundle.composeFallbackTriggered = true
    const fallbackRaw = await run({
      phaseId: "compose",
      label: "Compose canvas (retry)",
      systemPrompt: buildComposeFallbackPrompt(document, intentPlan, tokens),
      userContent,
      model,
      maxTokens: 8_000,
      signal: opts.signal,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
    })
    debugBundle.composeFallbackRaw = fallbackRaw.raw
    const fallbackResult = extractJsonFromStream(fallbackRaw.raw)
    if (fallbackResult.kind !== "message") {
      composed = fallbackResult
    } else {
      // Both attempts failed — propagate error with original trace.
      const err: DesignAgentPhaseTrace = { ...composeRaw.trace, state: "error", summary: "Compose parse failed (both attempts)" }
      if (phases.length > 0) phases[phases.length - 1] = err
      opts.onPhaseComplete?.(err)
      return { response: composed, phases, debugBundle }
    }
  }

  // If compose returned patches but there is no base document to apply them to,
  // retry with the fallback prompt (which explicitly asks for kind:"document").
  if (composed.kind === "patches" && !document) {
    debugBundle.composeFallbackTriggered = true
    const fbRaw = await run({
      phaseId: "compose",
      label: "Compose canvas (retry)",
      systemPrompt: buildComposeFallbackPrompt(null, intentPlan, tokens),
      userContent,
      model,
      maxTokens: 8_000,
      signal: opts.signal,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
    })
    debugBundle.composeFallbackRaw = fbRaw.raw
    const fbResult = extractJsonFromStream(fbRaw.raw)
    if (fbResult.kind !== "message") {
      composed = fbResult
    } else {
      const err: DesignAgentPhaseTrace = { ...composeRaw.trace, state: "error", summary: "Patches without base document (fallback also failed)" }
      if (phases.length > 0) phases[phases.length - 1] = err
      opts.onPhaseComplete?.(err)
      return {
        response: { kind: "message", text: "Model returned patches but no document exists yet. Try again with a shorter brief." },
        phases,
        debugBundle,
      }
    }
  }

  let workingDoc: DesignDocument | null = document
  if (composed.kind === "document") {
    workingDoc = composed.document
  } else if (composed.kind === "patches" && document) {
    const afterPatches = applyPatchesToDocument(document, composed.patches)
    const totalElsAfter = afterPatches.pages.reduce((s, p) => s + (p.elements?.length ?? 0), 0)
    const totalElsBefore = document.pages.reduce((s, p) => s + (p.elements?.length ?? 0), 0)
    // If patches added nothing (all pageIds were wrong), fall back to a full-document compose.
    if (totalElsAfter === totalElsBefore && !debugBundle.composeFallbackTriggered) {
      debugBundle.composeFallbackTriggered = true
      const fbRaw = await run({
        phaseId: "compose",
        label: "Compose canvas (retry)",
        systemPrompt: buildComposeFallbackPrompt(document, intentPlan, tokens),
        userContent,
        model,
        maxTokens: 8_000,
        signal: opts.signal,
        onToken: opts.onToken,
        onAgentPhase: opts.onAgentPhase,
        onPhaseBuffer: opts.onPhaseBuffer,
      })
      debugBundle.composeFallbackRaw = fbRaw.raw
      const fbResult = extractJsonFromStream(fbRaw.raw)
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
