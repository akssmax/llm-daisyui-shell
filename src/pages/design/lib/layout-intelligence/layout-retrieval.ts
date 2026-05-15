import type { IntentPlanPayload } from "../design-agent-schemas"
import { getAllLayouts, getStylePresetById } from "./layout-catalog"
import type {
  LayoutCategory,
  LayoutPattern,
  LayoutRetrievalQuery,
  LayoutRetrievalResult,
  ScoredLayout,
} from "./types"

const CATEGORY_ALIASES: Record<string, LayoutCategory> = {
  linkedin: "linkedin-carousel",
  carousel: "linkedin-carousel",
  presentation: "presentation-slide",
  slide: "presentation-slide",
  pitch: "presentation-slide",
  social: "social-post",
  instagram: "social-post",
  quote: "quote-card",
  metrics: "metrics-slide",
  kpi: "metrics-slide",
  timeline: "timeline-slide",
  feature: "feature-slide",
  product: "product-showcase",
  editorial: "editorial-poster",
  poster: "editorial-poster",
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function inferCategory(query: LayoutRetrievalQuery, intent?: IntentPlanPayload): LayoutCategory | undefined {
  if (query.category && query.category in CATEGORY_ALIASES === false) {
    const c = query.category as LayoutCategory
    if (getAllLayouts().some((l) => l.category === c)) return c
  }
  const blob = [
    query.category ?? "",
    query.platform ?? "",
    query.userPrompt ?? "",
    intent?.intent.platform ?? "",
    intent?.intent.designType ?? "",
    intent?.plan.layoutType ?? "",
  ]
    .join(" ")
    .toLowerCase()

  for (const [key, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (blob.includes(key)) return cat
  }
  return undefined
}

function aspectFit(
  pattern: LayoutPattern,
  aspect?: { w: number; h: number },
): number {
  if (!aspect) return 0.5
  let best = 0
  for (const a of pattern.supportedAspects) {
    const ratioA = a.w / a.h
    const ratioB = aspect.w / aspect.h
    const diff = Math.abs(ratioA - ratioB)
    best = Math.max(best, 1 - Math.min(diff, 1))
  }
  return best
}

function scoreLayout(
  pattern: LayoutPattern,
  query: LayoutRetrievalQuery,
  intent?: IntentPlanPayload,
): ScoredLayout {
  const reasons: string[] = []
  let score = 0

  const category = inferCategory(query, intent)
  if (category && pattern.category === category) {
    score += 35
    reasons.push("category match")
  }

  const queryTags = new Set([
    ...(query.styleTags ?? []),
    ...tokenize(query.userPrompt ?? ""),
    ...tokenize(intent?.intent.tone ?? ""),
    ...tokenize(intent?.plan.layoutType ?? ""),
  ])

  for (const tag of pattern.styleTags) {
    if (queryTags.has(tag.toLowerCase())) {
      score += 8
      reasons.push(`tag:${tag}`)
    }
  }

  const density = query.density ?? intent?.intent.density
  if (density) {
    const map = { minimal: "low", normal: "medium", dense: "high" } as const
    const mapped = map[density as keyof typeof map] ?? density
    if (pattern.density === mapped) {
      score += 12
      reasons.push("density match")
    }
  }

  const hierarchy = query.hierarchy
  if (hierarchy && pattern.hierarchy === hierarchy) {
    score += 10
    reasons.push("hierarchy match")
  }

  if (intent?.plan.layoutType) {
    const lt = intent.plan.layoutType.toLowerCase()
    if (pattern.archetype.includes(lt) || lt.includes(pattern.archetype.replace(/-/g, ""))) {
      score += 15
      reasons.push("archetype match")
    }
  }

  score += aspectFit(pattern, query.aspectRatio) * 12

  const memoryBoost = query.memoryBoost?.layoutScores[pattern.id]
  if (memoryBoost && memoryBoost > 0) {
    score += Math.min(memoryBoost * 20, 25)
    reasons.push("memory boost")
  }

  const stylePreset = query.styleTags?.length
    ? getStylePresetById(query.styleTags[0] ?? "")
    : undefined
  if (stylePreset?.preferredArchetypes.includes(pattern.archetype)) {
    score += 14
    reasons.push("style archetype preference")
  }

  return { pattern, score, reasons }
}

export function retrieveLayouts(
  query: LayoutRetrievalQuery,
  intent?: IntentPlanPayload,
): LayoutRetrievalResult {
  const layouts = getAllLayouts()
  const matches = layouts
    .map((p) => scoreLayout(p, query, intent))
    .sort((a, b) => b.score - a.score)

  const top5 = matches.slice(0, 5).map((m) => m.pattern)
  const top3 = matches.slice(0, 3).map((m) => m.pattern)

  return { matches, top3, top5 }
}

export function pickBestLayout(
  query: LayoutRetrievalQuery,
  intent?: IntentPlanPayload,
): ScoredLayout | null {
  const { matches } = retrieveLayouts(query, intent)
  return matches[0] ?? null
}

export function buildRetrievalQueryFromIntent(
  userPrompt: string,
  intent: IntentPlanPayload,
  overrides?: Partial<LayoutRetrievalQuery>,
): LayoutRetrievalQuery {
  const densityMap = { minimal: "low" as const, normal: "medium" as const, dense: "high" as const }
  return {
    userPrompt,
    platform: intent.intent.platform,
    density: densityMap[intent.intent.density],
    hierarchy: intent.plan.visualHierarchy.length <= 2 ? "strong" : "balanced",
    styleTags: tokenize(`${intent.intent.tone} ${intent.plan.layoutType}`),
    ...overrides,
  }
}
