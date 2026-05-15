import type { IntentPlanPayload } from "../design-agent-schemas"
import { getAllLayouts, getLayoutById, layoutPatternToLayoutTree } from "./layout-catalog"
import type { ContentProfile } from "./content-profile"
import { buildRetrievalQueryFromIntent, retrieveLayouts } from "./layout-retrieval"
import type { LayoutMemorySignals, LayoutPattern, ScoredLayout } from "./types"
import { getBanditReward } from "./design-bandit"

export type LayoutFitScore = {
  pattern: LayoutPattern
  retrievalScore: number
  contentFitScore: number
  banditScore: number
  finalScore: number
  reasons: string[]
}

function regionIds(layout: LayoutPattern): Set<string> {
  return new Set(layout.regions.map((r) => r.id))
}

function regionRoles(layout: LayoutPattern): Set<string> {
  return new Set(layout.regions.map((r) => r.role))
}

function scoreContentFit(layout: LayoutPattern, profile: ContentProfile): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 50
  const constraints = layout.constraints?.regions ?? {}
  const roles = regionRoles(layout)
  const ids = regionIds(layout)

  const headlineMax = constraints.headline?.maxChars ?? 72
  if (profile.maxHeadlineChars > headlineMax) {
    score -= 15
    reasons.push("headline may overflow")
  } else if (profile.maxHeadlineChars > 0 && ids.has("headline")) {
    score += 10
    reasons.push("headline region fits")
  }

  const bodyMax = constraints.body?.maxChars ?? 200
  if (profile.maxBodyChars > bodyMax * 1.2) {
    score -= 20
    reasons.push("body too long for layout")
  } else if (profile.maxBodyChars > 0 && (ids.has("body") || roles.has("body"))) {
    score += 8
  }

  if (profile.slideCount > 1) {
    if (layout.category === "linkedin-carousel") {
      score += 25
      reasons.push("carousel category")
    }
    if (layout.id === "li-carousel-split" || layout.archetype === "split") {
      score += 20
      reasons.push("split carousel layout")
    }
    const carouselShape =
      ids.has("headline") && ids.has("body") && (ids.has("visual") || ids.has("icon")) && (ids.has("footer") || ids.has("cta"))
    if (carouselShape) {
      score += 15
      reasons.push("headline+body+visual+footer")
    }
  }

  if (profile.needsIcon) {
    const hasIconSlot = layout.regions.some(
      (r) => r.role === "icon" || r.id === "visual" || r.id.includes("icon"),
    )
    if (hasIconSlot) {
      score += 12
      reasons.push("icon/visual slot")
    } else {
      score -= 10
    }
  }

  if (profile.statCount >= 2 && (ids.has("stats") || layout.archetype === "metrics-grid")) {
    score += 15
    reasons.push("metrics layout")
  }

  if (profile.hasQuote && (ids.has("quote") || layout.archetype === "quote-emphasis")) {
    score += 12
  }

  if (profile.hasFooter && (ids.has("footer") || ids.has("cta"))) {
    score += 6
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

export function scoreLayoutsForContent(
  candidates: LayoutPattern[],
  profile: ContentProfile,
  retrievalMatches: ScoredLayout[],
  banditContextKey: string,
): LayoutFitScore[] {
  const retrievalById = new Map(retrievalMatches.map((m) => [m.pattern.id, m.score]))

  return candidates.map((pattern) => {
    const retrievalScore = retrievalById.get(pattern.id) ?? 0
    const { score: contentFitScore, reasons } = scoreContentFit(pattern, profile)
    const banditScore = getBanditReward(banditContextKey, pattern.id) || 0
    const finalScore =
      0.45 * Math.min(Number(retrievalScore) || 0, 100) +
      0.35 * (Number(contentFitScore) || 0) +
      0.2 * (banditScore * 50 + 50)

    return {
      pattern,
      retrievalScore,
      contentFitScore,
      banditScore,
      finalScore,
      reasons,
    }
  })
}

export type SelectLayoutInput = {
  intentPlan: IntentPlanPayload
  userPrompt: string
  profile: ContentProfile
  memorySignals: LayoutMemorySignals
  pageDims: { w: number; h: number }
  banditContextKey: string
}

export type SelectLayoutResult = {
  layoutId: string
  layout: LayoutPattern
  confidence: number
  ranked: LayoutFitScore[]
}

export function selectLayoutForContent(input: SelectLayoutInput): SelectLayoutResult {
  const { intentPlan, userPrompt, profile, memorySignals, pageDims, banditContextKey } = input

  const query = buildRetrievalQueryFromIntent(userPrompt, intentPlan, {
    memoryBoost: memorySignals,
    aspectRatio: pageDims,
  })
  if (profile.slideCount > 1) {
    query.category = "linkedin-carousel"
  }

  const retrieval = retrieveLayouts(query, intentPlan)
  const candidateIds = new Set<string>()
  const candidates: LayoutPattern[] = []

  for (const m of retrieval.matches.slice(0, 8)) {
    if (!candidateIds.has(m.pattern.id)) {
      candidateIds.add(m.pattern.id)
      candidates.push(m.pattern)
    }
  }

  if (profile.slideCount > 1) {
    const split = getLayoutById("li-carousel-split")
    if (split && !candidateIds.has(split.id)) {
      candidates.unshift(split)
      candidateIds.add(split.id)
    }
  }

  if (candidates.length === 0) {
    const fallback = getAllLayouts()[0]!
    return {
      layoutId: fallback.id,
      layout: fallback,
      confidence: 0.3,
      ranked: [],
    }
  }

  const ranked = scoreLayoutsForContent(candidates, profile, retrieval.matches, banditContextKey).sort(
    (a, b) => b.finalScore - a.finalScore,
  )

  const top = ranked[0]!
  const confidence = Number.isFinite(top.finalScore) ? Math.min(top.finalScore / 100, 1) : 0.65

  return {
    layoutId: top.pattern.id,
    layout: top.pattern,
    confidence,
    ranked,
  }
}

export { layoutPatternToLayoutTree }
