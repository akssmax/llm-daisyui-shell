export type LayoutCategory =
  | "linkedin-carousel"
  | "presentation-slide"
  | "social-post"
  | "quote-card"
  | "metrics-slide"
  | "timeline-slide"
  | "feature-slide"
  | "product-showcase"
  | "editorial-poster"

export type LayoutArchetype =
  | "hero-centered"
  | "split"
  | "editorial-asymmetric"
  | "bento-grid"
  | "timeline"
  | "metrics-grid"
  | "full-bleed-image"
  | "minimal-swiss"
  | "quote-emphasis"
  | "checklist"
  | "product-spotlight"
  | "alternating-sections"
  | "layered-card"
  | "two-column-editorial"
  | "bold-typography-poster"

export type RegionRole =
  | "headline"
  | "subheading"
  | "body"
  | "image"
  | "cta"
  | "quote"
  | "stats"
  | "footer"
  | "icon"

export type FontScaleStep = "caption" | "body" | "h3" | "h2" | "h1" | "hero"

export type RegionConstraint = {
  maxLines?: number
  maxChars?: number
  preferredLineCount?: number
  minFontScale?: FontScaleStep
  maxFontScale?: FontScaleStep
  visualWeight?: number
  avoidOverlapWith?: string[]
  minDistanceFromEdge?: number
}

export type LayoutConstraints = {
  regions: Record<string, RegionConstraint>
}

export type LayoutRegionDef = {
  id: string
  role: RegionRole
  relativeRect: { x: number; y: number; w: number; h: number }
  alignment: "left" | "center" | "right"
  importance: "primary" | "secondary" | "tertiary"
  /** Suggested Lucide icon (kebab-case) when role is icon. */
  iconHint?: string
}

export type LayoutPattern = {
  id: string
  category: LayoutCategory
  archetype: LayoutArchetype
  styleTags: string[]
  density: "low" | "medium" | "high"
  hierarchy: "strong" | "balanced"
  grid: { columns: 12; safeMargin: number }
  regions: LayoutRegionDef[]
  supportedAspects: Array<{ w: number; h: number }>
  constraints?: LayoutConstraints
  reference?: {
    source: string
    archetype: string
    inspiration?: string
    tags?: string[]
  }
}

export type TypographyScale = {
  hero: number
  h1: number
  h2: number
  h3: number
  body: number
  caption: number
}

export type ColorSystem = {
  background: string
  surface: string
  textPrimary: string
  textSecondary: string
  accent: string
  accentMuted?: string
}

export type ShadowTokens = {
  sm: string
  md: string
  lg: string
}

export type DesignTokensPreset = {
  id: string
  name: string
  styleTags: string[]
  spacing: number[]
  typography: TypographyScale
  colors: ColorSystem
  radius: number[]
  shadows: ShadowTokens
  rules: {
    lineHeight: Record<string, number>
    maxLineWidth: number
    contrastMin: number
  }
  headingFont: string
  bodyFont: string
}

export type StylePreset = {
  id: string
  name: string
  styleTags: string[]
  tokenPresetId: string
  preferredArchetypes: LayoutArchetype[]
  layoutDensity: "low" | "medium" | "high"
  hierarchy: "strong" | "balanced"
}

export type LayoutRetrievalQuery = {
  category?: LayoutCategory | string
  styleTags?: string[]
  density?: "low" | "medium" | "high"
  hierarchy?: "strong" | "balanced"
  platform?: string
  aspectRatio?: { w: number; h: number }
  userPrompt?: string
  memoryBoost?: LayoutMemorySignals
}

export type LayoutMemorySignals = {
  layoutScores: Record<string, number>
  styleScores?: Record<string, number>
  tokenScores?: Record<string, number>
}

export type ScoredLayout = {
  pattern: LayoutPattern
  score: number
  reasons: string[]
}

export type LayoutRetrievalResult = {
  matches: ScoredLayout[]
  top3: LayoutPattern[]
  top5: LayoutPattern[]
}

export type CritiqueIssueType =
  | "hierarchy"
  | "spacing"
  | "contrast"
  | "alignment"
  | "readability"
  | "balance"
  | "overcrowding"

export type CritiqueIssue = {
  type: CritiqueIssueType
  severity: "low" | "medium" | "high"
  message: string
  elementIds?: string[]
}

export type DesignCritique = {
  hierarchyScore: number
  spacingScore: number
  contrastScore: number
  alignmentScore: number
  readabilityScore: number
  balanceScore: number
  compositeScore: number
  issues: CritiqueIssue[]
}

export type DesignMemoryRecord = {
  id: string
  timestamp: number
  layoutId: string
  stylePresetId: string
  tokenPresetId: string
  category: string
  userRating?: 1 | -1 | null
  critiqueScore: number
  promptHash: string
  applied: boolean
}

export type LayoutSelectionResult = {
  layoutId: string
  layout: LayoutPattern
  confidence: number
}

export type ContentMapResult = {
  regionContents: Array<{
    regionId: string
    content: string
    fontSize?: number
    fontWeight?: string
    textAlign?: "left" | "center" | "right"
    kind?: "text" | "shape" | "icon"
    fill?: string
    iconName?: string
    color?: string
  }>
}

export type DesignVariant = {
  layoutId: string
  document: import("../../types").DesignDocument
  critique: DesignCritique
}
