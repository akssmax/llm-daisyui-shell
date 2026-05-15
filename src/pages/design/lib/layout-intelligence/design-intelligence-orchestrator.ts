import type { DesignAiResponse, DesignDocument } from "../../types"
import { safePageElements } from "../safe-page-elements"
import type { DesignAgentPhaseTrace } from "../design-agent-orchestrator"
import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "../design-agent-schemas"
import {
  parseContentMap,
  parseContentMapSlides,
  parseIntentPlan,
  parseJsonObjectFromModel,
  parseLayoutSelect,
  parseTailwindThemeFromDesignSystem,
} from "../design-agent-schemas"
import { parseRegionContentsCompose } from "../design-compose-assembler"
import { deterministicRepairElements, validateDesignDocument } from "../design-validate"
import {
  buildContentMapPhasePrompt,
  buildContentMapRetryPrompt,
  buildDesignSystemPhasePrompt,
  buildIntentPlanSystemPrompt,
  buildLayoutSelectPhasePrompt,
} from "../design-phase-prompts"
import type { RunDesignAgentTurnOptions } from "../design-agent-orchestrator"
import { runJsonPhase } from "../design-agent-orchestrator-helpers"
import {
  getLayoutById,
  getStylePresetById,
  getTokenPresetById,
  layoutPatternToLayoutTree,
  tokenPresetToBundle,
} from "./layout-catalog"
import { buildRetrievalQueryFromIntent, retrieveLayouts } from "./layout-retrieval"
import { getLayoutMemorySignals, hashPrompt, recordDesignMemory } from "./design-memory-store"
import { critiqueDesign } from "./design-critic"
import { assembleMultiSlideDocument } from "./multi-slide-assembler"
import {
  inferDocumentType,
  inferSlideCount,
  inferSlidesToAdd,
  pageDimensionsForIntent,
} from "./slide-utils"
import { pickStylePresetForIntent } from "./style-auto-pick"
import { buildTailwindTokenBundle } from "./tailwind-theme-builder"
import type { DesignTokensPreset } from "./types"
import {
  assembleDocumentFromRegionContents,
  type RegionContent,
} from "../design-compose-assembler"
import { runFullQualityPipeline } from "./design-auto-fix"
import type { DesignVariant } from "./types"

export type IntelligenceTurnResult = {
  response: DesignAiResponse
  phases: DesignAgentPhaseTrace[]
  debugBundle: Record<string, unknown>
  variants?: DesignVariant[]
  selectedLayoutId?: string
  tokenPresetId?: string
  critiqueScore?: number
}

function documentHasElements(doc: DesignDocument | null): boolean {
  if (!doc) return false
  for (const p of doc.pages) {
    if (safePageElements(p).length > 0) return true
  }
  return false
}

async function rulePickLayout(
  intentPlan: IntentPlanPayload,
  userPrompt: string,
): Promise<{ layoutId: string; layout: LayoutTree; confidence: number } | null> {
  const memorySignals = await getLayoutMemorySignals(intentPlan.intent.designType)
  const query = buildRetrievalQueryFromIntent(userPrompt, intentPlan, { memoryBoost: memorySignals })
  const { matches } = retrieveLayouts(query, intentPlan)
  const top = matches[0]
  if (!top || top.score < 20) return null
  const pattern = top.pattern
  return {
    layoutId: pattern.id,
    layout: layoutPatternToLayoutTree(pattern) as LayoutTree,
    confidence: Math.min(top.score / 80, 1),
  }
}

export async function runIntelligenceAgentTurn(
  opts: RunDesignAgentTurnOptions,
): Promise<IntelligenceTurnResult> {
  const { useDesignStore } = await import("../../store/design-store")
  const store = useDesignStore.getState()
  const model = opts.model ?? store.designChatModel
  const phases: DesignAgentPhaseTrace[] = []
  const debugBundle: Record<string, unknown> = {}
  const userContent = opts.userMessage.trim()
  const existingDocument = store.document

  const pushPhase = (t: DesignAgentPhaseTrace) => {
    phases.push(t)
    opts.onPhaseComplete?.(t)
  }

  const run = async (args: Omit<Parameters<typeof runJsonPhase>[0], "model">) => {
    const running: DesignAgentPhaseTrace = {
      id: args.phaseId,
      label: args.label,
      summary: "",
      state: "running",
    }
    pushPhase(running)
    return runJsonPhase({
      ...args,
      model,
      onToken: opts.onToken,
      onAgentPhase: opts.onAgentPhase,
      onPhaseBuffer: opts.onPhaseBuffer,
      onPhaseEnd: (t) => {
        if (phases.length > 0) phases[phases.length - 1] = t
        opts.onPhaseComplete?.(t)
      },
    })
  }

  // 1. Intent plan
  const ipRaw = await run({
    phaseId: "intent_plan",
    label: "Intent & layout plan",
    systemPrompt: buildIntentPlanSystemPrompt(userContent),
    userContent,
    maxTokens: 1400,
    signal: opts.signal,
    attachments: opts.attachments,
  })
  const intentPlan = parseIntentPlan(parseJsonObjectFromModel(ipRaw.raw) ?? null)
  if (!intentPlan) {
    return {
      response: { kind: "message", text: "Design agent could not parse intent/plan." },
      phases,
      debugBundle,
    }
  }
  debugBundle.intentPlan = intentPlan

  const slidesToAdd = inferSlidesToAdd(userContent)
  const isExtendMode = slidesToAdd > 0 && documentHasElements(existingDocument)
  const slideCount = isExtendMode ? slidesToAdd : inferSlideCount(userContent, intentPlan)
  const documentType = inferDocumentType(userContent, intentPlan)
  const pageDims = pageDimensionsForIntent(userContent, intentPlan)
  debugBundle.slideCount = slideCount
  debugBundle.documentType = documentType
  debugBundle.isExtendMode = isExtendMode
  if (isExtendMode && existingDocument) {
    debugBundle.existingPageCount = existingDocument.pages.length
  }

  // 2. Layout retrieval (client)
  const memorySignals = await getLayoutMemorySignals(intentPlan.intent.designType)
  const autoStyle = pickStylePresetForIntent(userContent, intentPlan)
  const retrievalQuery = buildRetrievalQueryFromIntent(userContent, intentPlan, {
    memoryBoost: memorySignals,
    density: autoStyle?.layoutDensity,
    hierarchy: autoStyle?.hierarchy,
    styleTags: autoStyle?.styleTags,
  })
  if (slideCount > 1) {
    retrievalQuery.category = "linkedin-carousel"
  }
  const retrieval = retrieveLayouts(retrievalQuery, intentPlan)
  debugBundle.retrieval = retrieval.matches.slice(0, 5).map((m) => ({ id: m.pattern.id, score: m.score }))

  pushPhase({
    id: "layout_retrieval",
    label: "Layout retrieval",
    summary: `Top: ${retrieval.top3.map((l) => l.id).join(", ")}`,
    state: "complete",
  })

  // 3. Layout select (LLM or rules)
  let selectedLayoutId: string
  let layout: LayoutTree

  const rulePick = await rulePickLayout(intentPlan, userContent)
  if (rulePick && rulePick.confidence >= 0.65) {
    selectedLayoutId = rulePick.layoutId
    layout = rulePick.layout
    pushPhase({
      id: "layout_select",
      label: "Layout selection",
      summary: `Rule pick: ${selectedLayoutId} (${Math.round(rulePick.confidence * 100)}%)`,
      state: "complete",
    })
  } else {
    const lsRaw = await run({
      phaseId: "layout_select",
      label: "Layout selection",
      systemPrompt: buildLayoutSelectPhasePrompt(userContent, intentPlan, retrieval.top3),
      userContent,
      maxTokens: 800,
      signal: opts.signal,
    })
    const lsParsed = parseLayoutSelect(parseJsonObjectFromModel(lsRaw.raw))
    const pattern = lsParsed ? getLayoutById(lsParsed.layoutId) : retrieval.top3[0]
    if (!pattern) {
      return {
        response: { kind: "message", text: "No matching layout in catalog." },
        phases,
        debugBundle,
      }
    }
    selectedLayoutId = pattern.id
    layout = layoutPatternToLayoutTree(pattern) as LayoutTree
    debugBundle.layoutSelectRaw = lsRaw.raw
  }

  // 4. Design system / tokens (named preset OR Tailwind accent from LLM)
  let tokens: DesignTokenBundle
  let tokenPresetId = autoStyle?.tokenPresetId
  let activeTokenPreset: DesignTokensPreset | undefined
  let enforceTailwindOnly = false

  const presetFromStyle = tokenPresetId ? getTokenPresetById(tokenPresetId) : null
  if (presetFromStyle) {
    tokens = tokenPresetToBundle(presetFromStyle) as DesignTokenBundle
    tokenPresetId = presetFromStyle.id
    activeTokenPreset = presetFromStyle
    pushPhase({
      id: "design_system",
      label: "Design tokens",
      summary: `Style preset: ${presetFromStyle.name ?? tokenPresetId}`,
      state: "complete",
    })
  } else {
    const dsRaw = await run({
      phaseId: "design_system",
      label: "Design tokens",
      systemPrompt: buildDesignSystemPhasePrompt(userContent, intentPlan),
      userContent,
      maxTokens: 400,
      signal: opts.signal,
    })
    const dsObj = parseJsonObjectFromModel(dsRaw.raw)
    const themeSel = parseTailwindThemeFromDesignSystem(dsObj)
    const tw = buildTailwindTokenBundle({
      accentHue: themeSel?.accentHue ?? "indigo",
      mode: themeSel?.mode ?? "light",
    })
    tokens = tokenPresetToBundle(tw) as DesignTokenBundle
    tokenPresetId = undefined
    activeTokenPreset = tw
    enforceTailwindOnly = true
    debugBundle.tailwindTheme = {
      accentHue: themeSel?.accentHue ?? "indigo",
      mode: themeSel?.mode ?? "light",
    }
    pushPhase({
      id: "design_system",
      label: "Design tokens",
      summary: `Tailwind ${themeSel?.accentHue ?? "indigo"} (${themeSel?.mode ?? "light"})`,
      state: "complete",
    })
  }

  // 5. Content map
  const contentMaxTokens = slideCount > 1 ? 8000 : 4000
  const contentMapUserContent = isExtendMode
    ? `Add ${slideCount} NEW slides to the deck. Write copy only for these new slides (slideIndex 0..${slideCount - 1}). Do not repeat existing slides.\n\n${userContent}`
    : userContent

  const cmRaw = await run({
    phaseId: "content_map",
    label: slideCount > 1 ? `Content mapping (${slideCount} slides)` : "Content mapping",
    systemPrompt: buildContentMapPhasePrompt(contentMapUserContent, intentPlan, layout, tokens, slideCount),
    userContent: contentMapUserContent,
    maxTokens: contentMaxTokens,
    signal: opts.signal,
  })
  let cmObj = parseJsonObjectFromModel(cmRaw.raw)
  let slidePayload = cmObj ? parseContentMapSlides(cmObj) : null

  if (slideCount > 1 && !slidePayload) {
    const cmRetryRaw = await run({
      phaseId: "content_map",
      label: "Content mapping (retry)",
      systemPrompt: buildContentMapRetryPrompt(contentMapUserContent, intentPlan, layout, tokens, slideCount),
      userContent: contentMapUserContent,
      maxTokens: contentMaxTokens,
      signal: opts.signal,
    })
    cmObj = parseJsonObjectFromModel(cmRetryRaw.raw)
    slidePayload = cmObj ? parseContentMapSlides(cmObj) : null
    debugBundle.contentMapRetried = true
  }

  pushPhase({
    id: "assemble",
    label: "Assemble & refine",
    summary: slideCount > 1 ? `Building ${slideCount} slides…` : "Building design…",
    state: "running",
  })

  let workingDoc
  const margin = intentPlan.plan.grid.safeMargin
  const pipelineOpts = {
    safeMargin: margin,
    tokenPresetId,
    tokenPreset: activeTokenPreset,
    enforceTailwindOnly,
  }

  if (slideCount > 1) {
    if (!slidePayload) {
      debugBundle.contentMapMode = "single-fallback-blocked"
      pushPhase({
        id: "assemble",
        label: "Assemble & refine",
        summary: "Failed — invalid multi-slide content map",
        state: "error",
      })
      return {
        response: {
          kind: "message",
          text: "Design agent could not map content to separate slides. The model must return a slides[] array with one entry per slide. Try again with a shorter brief.",
        },
        phases,
        debugBundle,
      }
    }

    debugBundle.contentMapMode = "multi"
    const slides: RegionContent[][] = []
    for (let i = 0; i < slideCount; i++) {
      const slide = slidePayload.slides.find((s) => s.slideIndex === i) ?? slidePayload.slides[i]
      slides.push(slide?.regionContents ?? [])
    }
    workingDoc = assembleMultiSlideDocument(
      layout,
      { slides, slideCount },
      {
        intentPlan,
        tokens,
        userMessage: userContent,
        documentType,
        title: intentPlan.intent.designType,
        ...pipelineOpts,
      },
    )
  } else {
    let regionContents = cmObj ? parseContentMap(cmObj) : null
    if (!regionContents || regionContents.length === 0) {
      regionContents = parseRegionContentsCompose(cmRaw.raw)
    }
    if (!regionContents || regionContents.length === 0) {
      return {
        response: { kind: "message", text: "Design agent could not map content to layout regions." },
        phases,
        debugBundle,
      }
    }

    let doc = assembleDocumentFromRegionContents(layout, regionContents, {
      intentPlan,
      tokens,
      title: intentPlan.intent.designType,
      pageWidth: pageDims.width,
      pageHeight: pageDims.height,
    })
    doc = { ...doc, type: documentType }
    const refined = runFullQualityPipeline(doc, pipelineOpts)
    workingDoc = refined.document
  }

  if (isExtendMode && existingDocument) {
    workingDoc = {
      ...existingDocument,
      pages: [...existingDocument.pages, ...workingDoc.pages],
      type: existingDocument.type ?? documentType,
      updatedAt: new Date().toISOString(),
    }
    debugBundle.mergedPageCount = workingDoc.pages.length
  }

  workingDoc = {
    ...workingDoc,
    pages: workingDoc.pages.map((p) => ({
      ...p,
      elements: deterministicRepairElements(p.elements ?? [], { width: p.width, height: p.height }),
    })),
  }

  const validation = validateDesignDocument(workingDoc, { safeMargin: margin })
  const critique = critiqueDesign(workingDoc, pipelineOpts)

  pushPhase({
    id: "critic",
    label: "Design critic",
    summary: `Score ${critique.compositeScore}/100 · ${workingDoc.pages.length} page(s)`,
    state: "complete",
  })

  pushPhase({
    id: "finalize",
    label: "Finalize",
    summary: `${selectedLayoutId} · ${workingDoc.pages.length} slide(s)`,
    state: "complete",
  })

  debugBundle.validation = validation
  debugBundle.critique = critique

  useDesignStore.setState({
    lastLayoutId: selectedLayoutId,
    lastCritiqueScore: critique.compositeScore,
    regenerationMode: null,
    designVariants: null,
  })

  void recordDesignMemory({
    layoutId: selectedLayoutId,
    stylePresetId: autoStyle?.id ?? "default",
    tokenPresetId: tokenPresetId ?? "modern-saas",
    category: intentPlan.intent.designType,
    critiqueScore: critique.compositeScore,
    promptHash: hashPrompt(userContent),
    applied: true,
    userRating: null,
  })

  const assistantNote = `${workingDoc.pages.length} slide(s) · Layout: ${selectedLayoutId} · Quality: ${critique.compositeScore}/100`

  return {
    response: {
      kind: "document",
      document: workingDoc,
      assistantNote,
    },
    phases,
    debugBundle,
    selectedLayoutId,
    tokenPresetId,
    critiqueScore: critique.compositeScore,
  }
}
