import type { DesignAiResponse, DesignDocument } from "../../types"
import { safePageElements } from "../safe-page-elements"
import type { DesignAgentPhaseTrace } from "../design-agent-orchestrator"
import type { DesignTokenBundle, LayoutTree } from "../design-agent-schemas"
import {
  parseContentMap,
  parseContentMapSlides,
  parseContentStructure,
  parseIntentPlan,
  parseJsonObjectFromModel,
  parseLayoutSelect,
  parseTailwindThemeFromDesignSystem,
  type ContentStructure,
  type RegionContentPayload,
} from "../design-agent-schemas"
import { parseRegionContentsCompose } from "../design-compose-assembler"
import { deterministicRepairElements, validateDesignDocument } from "../design-validate"
import {
  buildContentMapPhasePrompt,
  buildContentMapRefinementPrompt,
  buildContentMapRetryPrompt,
  buildContentStructurePhasePrompt,
  buildDesignSystemPhasePrompt,
  buildIntentPlanSystemPrompt,
  buildLayoutSelectPhasePrompt,
} from "../design-phase-prompts"
import type { RunDesignAgentTurnOptions } from "../design-agent-orchestrator"
import { runJsonPhase } from "../design-agent-orchestrator-helpers"
import { getLayoutById, getTokenPresetById, tokenPresetToBundle } from "./layout-catalog"
import { buildRetrievalQueryFromIntent, retrieveLayouts } from "./layout-retrieval"
import { getLayoutMemorySignals, hashPrompt, recordDesignMemory } from "./design-memory-store"
import { critiqueDesign } from "./design-critic"
import { assembleMultiSlideDocument } from "./multi-slide-assembler"
import {
  inferSlideCount,
  inferSlidesToAdd,
  inferTargetSlideIndex,
  mergeEditedPageIntoDocument,
  resolveCanvasForTurn,
} from "./slide-utils"
import { applyCanvasSpecToDocument } from "./canvas-spec"
import { parsePatternId } from "../fill-pattern-catalog"
import { pickStylePresetForIntent } from "./style-auto-pick"
import { buildTailwindTokenBundle, normalizeAccentHue, normalizeThemeMode } from "./tailwind-theme-builder"
import type { DesignTokensPreset } from "./types"
import {
  assembleWithRefinement,
  formatCritiqueIssuesForPrompt,
  formatViolationsForPrompt,
  passesCriticGate,
} from "./design-refinement-loop"
import { validateContentAgainstConstraints } from "./constraint-validator"
import type { DesignVariant } from "./types"
import { buildContentProfile } from "./content-profile"
import { buildBanditContextKey, initBanditCache, recordBanditReward } from "./design-bandit"
import { layoutPatternToLayoutTree as patternToTree, selectLayoutForContent } from "./layout-fit-scorer"
import { bindRegionsToLayout, bindSlidesToLayout } from "./region-binder"

export type IntelligenceTurnResult = {
  response: DesignAiResponse
  phases: DesignAgentPhaseTrace[]
  debugBundle: Record<string, unknown>
  variants?: DesignVariant[]
  selectedLayoutId?: string
  tokenPresetId?: string
  critiqueScore?: number
  generationId?: string
}

function documentHasElements(doc: DesignDocument | null): boolean {
  if (!doc) return false
  for (const p of doc.pages) {
    if (safePageElements(p).length > 0) return true
  }
  return false
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
  const canvasPresetMode = store.canvasPresetMode ?? "auto"

  await initBanditCache()

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

  // 1. Intent plan (+ canvas format when preset is "auto")
  const ipRaw = await run({
    phaseId: "intent_plan",
    label: "Intent & canvas plan",
    systemPrompt: buildIntentPlanSystemPrompt(userContent, canvasPresetMode),
    userContent,
    maxTokens: 1600,
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

  const canvasSpec = resolveCanvasForTurn(userContent, intentPlan, canvasPresetMode)
  debugBundle.canvasSpec = canvasSpec

  pushPhase({
    id: "canvas_select",
    label: "Canvas size",
    summary: `${canvasSpec.label} · ${canvasSpec.width}×${canvasSpec.height}`,
    state: "complete",
  })

  const slidesToAdd = inferSlidesToAdd(userContent)
  const isExtendMode = slidesToAdd > 0 && documentHasElements(existingDocument)
  const targetSlideIndex = inferTargetSlideIndex(
    userContent,
    existingDocument?.pages.length,
  )
  const isEditPageMode =
    targetSlideIndex !== null &&
    documentHasElements(existingDocument) &&
    !isExtendMode
  const slideCount = isEditPageMode
    ? 1
    : isExtendMode
      ? slidesToAdd
      : inferSlideCount(userContent, intentPlan)
  const documentType = canvasSpec.documentType
  const pageDims = { width: canvasSpec.width, height: canvasSpec.height }
  debugBundle.slideCount = slideCount
  debugBundle.documentType = documentType
  debugBundle.isExtendMode = isExtendMode
  debugBundle.isEditPageMode = isEditPageMode
  if (isEditPageMode) {
    debugBundle.targetSlideIndex = targetSlideIndex
  }
  if (isExtendMode && existingDocument) {
    debugBundle.existingPageCount = existingDocument.pages.length
  }

  // 2. Design system / tokens (before layout)
  let tokens: DesignTokenBundle
  let tokenPresetId = pickStylePresetForIntent(userContent, intentPlan)?.tokenPresetId
  let activeTokenPreset: DesignTokensPreset | undefined
  let enforceTailwindOnly = false
  const autoStyle = pickStylePresetForIntent(userContent, intentPlan)

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
    const accentHue = normalizeAccentHue(themeSel?.accentHue)
    const mode = normalizeThemeMode(themeSel?.mode)
    const tw = buildTailwindTokenBundle({ accentHue, mode })
    tokens = tokenPresetToBundle(tw) as DesignTokenBundle
    tokenPresetId = undefined
    activeTokenPreset = tw
    enforceTailwindOnly = true
    debugBundle.tailwindTheme = { accentHue, mode }
    pushPhase({
      id: "design_system",
      label: "Design tokens",
      summary: `Tailwind ${themeSel?.accentHue ?? "indigo"} (${themeSel?.mode ?? "light"})`,
      state: "complete",
    })
  }

  // 3. Content structure (single-slide)
  let contentStructure: ContentStructure | null = null
  if (slideCount === 1) {
    const csRaw = await run({
      phaseId: "content_structure",
      label: "Content structure",
      systemPrompt: buildContentStructurePhasePrompt(userContent, intentPlan),
      userContent,
      maxTokens: 1200,
      signal: opts.signal,
    })
    const csObj = parseJsonObjectFromModel(csRaw.raw)
    contentStructure = csObj ? parseContentStructure(csObj) : null
    debugBundle.contentStructure = contentStructure
  }

  // 4. Content map (layout-agnostic)
  const contentMaxTokens = slideCount > 1 ? 8000 : 4000
  const contentMapUserContent = isEditPageMode
    ? `Replace ALL content on slide ${targetSlideIndex! + 1} only (1-based). Other slides must not be mentioned. Design a fresh layout for:\n\n${userContent}`
    : isExtendMode
      ? `Add ${slideCount} NEW slides to the deck. Write copy only for these new slides (slideIndex 0..${slideCount - 1}). Do not repeat existing slides.\n\n${userContent}`
      : userContent

  const cmRaw = await run({
    phaseId: "content_map",
    label: slideCount > 1 ? `Content mapping (${slideCount} slides)` : "Content mapping",
    systemPrompt: buildContentMapPhasePrompt(
      contentMapUserContent,
      intentPlan,
      null,
      tokens,
      slideCount,
      contentStructure ?? undefined,
    ),
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
      systemPrompt: buildContentMapRetryPrompt(contentMapUserContent, intentPlan, null, tokens, slideCount),
      userContent: contentMapUserContent,
      maxTokens: contentMaxTokens,
      signal: opts.signal,
    })
    cmObj = parseJsonObjectFromModel(cmRetryRaw.raw)
    slidePayload = cmObj ? parseContentMapSlides(cmObj) : null
    debugBundle.contentMapRetried = true
  }

  const draftSlides: RegionContentPayload[][] = []
  if (slideCount > 1) {
    if (!slidePayload) {
      return {
        response: {
          kind: "message",
          text: "Design agent could not map content to separate slides. The model must return a slides[] array with one entry per slide. Try again with a shorter brief.",
        },
        phases,
        debugBundle,
      }
    }
    for (let i = 0; i < slideCount; i++) {
      const slide = slidePayload.slides.find((s) => s.slideIndex === i) ?? slidePayload.slides[i]
      draftSlides.push(slide?.regionContents ?? [])
    }
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
    draftSlides.push(regionContents)
  }

  const contentProfile = buildContentProfile(draftSlides, slideCount)
  debugBundle.contentProfile = contentProfile

  // 5. Layout retrieval + content-aware selection
  const memorySignals = await getLayoutMemorySignals(intentPlan.intent.designType)
  const banditContextKey = buildBanditContextKey(
    intentPlan.intent.designType,
    contentProfile,
    intentPlan.intent.tone,
  )

  const retrievalQuery = buildRetrievalQueryFromIntent(userContent, intentPlan, {
    memoryBoost: memorySignals,
    density: autoStyle?.layoutDensity,
    hierarchy: autoStyle?.hierarchy,
    styleTags: autoStyle?.styleTags,
    aspectRatio: { w: pageDims.width, h: pageDims.height },
  })
  if (slideCount > 1) {
    retrievalQuery.category = "linkedin-carousel"
  } else if (canvasSpec.documentType === "document" || canvasSpec.format.includes("a4")) {
    retrievalQuery.category = "editorial-poster"
  } else if (canvasSpec.documentType === "slide") {
    retrievalQuery.category = "presentation-slide"
  }
  const retrieval = retrieveLayouts(retrievalQuery, intentPlan)
  debugBundle.retrieval = retrieval.matches.slice(0, 5).map((m) => ({ id: m.pattern.id, score: m.score }))

  pushPhase({
    id: "layout_retrieval",
    label: "Layout retrieval",
    summary: `Top: ${retrieval.top3.map((l) => l.id).join(", ")}`,
    state: "complete",
  })

  const fitPick = selectLayoutForContent({
    intentPlan,
    userPrompt: userContent,
    profile: contentProfile,
    memorySignals,
    pageDims: { w: pageDims.width, h: pageDims.height },
    banditContextKey,
  })
  debugBundle.layoutFitRanked = fitPick.ranked.slice(0, 3).map((r) => ({
    id: r.pattern.id,
    finalScore: r.finalScore,
    reasons: r.reasons,
  }))

  let selectedLayoutId: string
  let layoutPattern = fitPick.layout
  let layout: LayoutTree = patternToTree(layoutPattern) as LayoutTree

  if (fitPick.confidence >= 0.65) {
    selectedLayoutId = fitPick.layoutId
    pushPhase({
      id: "layout_select",
      label: "Layout selection",
      summary: `Content fit: ${selectedLayoutId} (${Math.round(fitPick.confidence * 100)}%)`,
      state: "complete",
    })
  } else {
    const topCandidates = fitPick.ranked.slice(0, 3).map((r) => r.pattern)
    const lsRaw = await run({
      phaseId: "layout_select",
      label: "Layout selection",
      systemPrompt: buildLayoutSelectPhasePrompt(
        userContent,
        intentPlan,
        topCandidates.length > 0 ? topCandidates : retrieval.top3,
        contentProfile,
      ),
      userContent,
      maxTokens: 800,
      signal: opts.signal,
    })
    const lsParsed = parseLayoutSelect(parseJsonObjectFromModel(lsRaw.raw))
    const pattern = lsParsed ? getLayoutById(lsParsed.layoutId) : layoutPattern
    if (!pattern) {
      return {
        response: { kind: "message", text: "No matching layout in catalog." },
        phases,
        debugBundle,
      }
    }
    selectedLayoutId = pattern.id
    layoutPattern = pattern
    layout = patternToTree(pattern) as LayoutTree
    debugBundle.layoutSelectRaw = lsRaw.raw
    pushPhase({
      id: "layout_select",
      label: "Layout selection",
      summary: `LLM pick: ${selectedLayoutId}`,
      state: "complete",
    })
  }

  pushPhase({
    id: "region_bind",
    label: "Region bind",
    summary: `Mapped copy → ${layout.regions.length} regions`,
    state: "complete",
  })

  // 6. Assemble & refine
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
    const boundSlides = bindSlidesToLayout(layoutPattern, draftSlides)
    debugBundle.contentMapMode = "multi"
    workingDoc = assembleMultiSlideDocument(
      layout,
      { slides: boundSlides, slideCount },
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
    const boundContents = bindRegionsToLayout(layoutPattern, draftSlides[0] ?? [])
    const violations = validateContentAgainstConstraints(boundContents, layout.constraints)
    if (violations.length > 0) {
      pushPhase({
        id: "validate",
        label: "Constraint validation",
        summary: `${violations.length} issue(s) — fitting copy`,
        state: "complete",
      })
      debugBundle.contentViolations = violations
    }

    let refinement = assembleWithRefinement({
      layout,
      regionContents: boundContents,
      intentPlan,
      tokens,
      pageWidth: pageDims.width,
      pageHeight: pageDims.height,
      pipelineOpts,
      documentType,
    })

    if (!passesCriticGate(refinement.critique)) {
      pushPhase({
        id: "refine_engine",
        label: "Engine refinement",
        summary: `Score ${refinement.critique.compositeScore} — retrying copy`,
        state: "running",
      })
      const issueSummary = [
        formatViolationsForPrompt(violations),
        formatCritiqueIssuesForPrompt(refinement.critique),
      ]
        .filter(Boolean)
        .join("\n")
      const cmRetryRaw = await run({
        phaseId: "refine_content",
        label: "Content refinement",
        systemPrompt: buildContentMapRefinementPrompt(
          contentMapUserContent,
          intentPlan,
          layout,
          tokens,
          issueSummary,
          contentStructure ?? undefined,
        ),
        userContent: contentMapUserContent,
        maxTokens: contentMaxTokens,
        signal: opts.signal,
      })
      const retryObj = parseJsonObjectFromModel(cmRetryRaw.raw)
      const retryContents = retryObj ? parseContentMap(retryObj) : null
      if (retryContents && retryContents.length > 0) {
        const rebound = bindRegionsToLayout(layoutPattern, retryContents)
        refinement = assembleWithRefinement({
          layout,
          regionContents: rebound,
          intentPlan,
          tokens,
          pageWidth: pageDims.width,
          pageHeight: pageDims.height,
          pipelineOpts,
          documentType,
        })
      }
      pushPhase({
        id: "refine_engine",
        label: "Engine refinement",
        summary: `Final score ${refinement.critique.compositeScore}/100`,
        state: "complete",
      })
    }

    workingDoc = refinement.document
    debugBundle.refinementRounds = refinement.rounds
  }

  if (isEditPageMode && existingDocument && targetSlideIndex !== null) {
    const generated = workingDoc.pages[0]
    if (generated) {
      const sizedPage = {
        ...generated,
        width: canvasSpec.width,
        height: canvasSpec.height,
      }
      workingDoc = mergeEditedPageIntoDocument(existingDocument, targetSlideIndex, sizedPage)
      debugBundle.mergedPageCount = workingDoc.pages.length
    }
  } else {
    if (isExtendMode && existingDocument) {
      workingDoc = {
        ...existingDocument,
        pages: [...existingDocument.pages, ...workingDoc.pages],
        type: existingDocument.type ?? documentType,
        updatedAt: new Date().toISOString(),
      }
      debugBundle.mergedPageCount = workingDoc.pages.length
    }
    workingDoc = applyCanvasSpecToDocument(workingDoc, canvasSpec)
  }
  const pagePatternMatch = userContent.match(/pattern\s*[:=]\s*([a-z0-9-]+)/i)
  const pagePatternId = pagePatternMatch?.[1] ? parsePatternId(pagePatternMatch[1]) : null
  if (pagePatternId) {
    const patternColor = tokens.tokens.colors.accent ?? "#94A3B8"
    workingDoc = {
      ...workingDoc,
      pages: workingDoc.pages.map((p) => ({
        ...p,
        backgroundPattern: {
          patternId: pagePatternId,
          color: patternColor,
          backgroundColor: p.backgroundColor,
        },
      })),
    }
    debugBundle.pagePattern = pagePatternId
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
    id: "assemble",
    label: "Assemble & refine",
    summary: `Done · ${workingDoc.pages.length} slide(s)`,
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

  const generationId = await recordDesignMemory({
    layoutId: selectedLayoutId,
    stylePresetId: autoStyle?.id ?? "default",
    tokenPresetId: tokenPresetId ?? "modern-saas",
    category: intentPlan.intent.designType,
    critiqueScore: critique.compositeScore,
    promptHash: hashPrompt(userContent),
    applied: true,
    userRating: null,
  })

  const criticReward =
    critique.compositeScore >= 70 ? 0.3 : critique.compositeScore < 60 ? -0.2 : 0
  if (criticReward !== 0) {
    await recordBanditReward(banditContextKey, selectedLayoutId, criticReward)
  }

  useDesignStore.setState({
    lastLayoutId: selectedLayoutId,
    lastCritiqueScore: critique.compositeScore,
    lastGenerationId: generationId || null,
    lastBanditContextKey: banditContextKey,
    lastStylePresetId: autoStyle?.id ?? null,
    lastTokenPresetId: tokenPresetId ?? null,
    regenerationMode: null,
    designVariants: null,
  })

  const assistantNote = isEditPageMode
    ? `Updated slide ${targetSlideIndex! + 1} · Layout: ${selectedLayoutId} · Quality: ${critique.compositeScore}/100`
    : `${workingDoc.pages.length} slide(s) · Layout: ${selectedLayoutId} · Quality: ${critique.compositeScore}/100`

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
    generationId: generationId || undefined,
  }
}
