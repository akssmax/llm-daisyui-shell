import type { RegionAlignment, RegionImportance } from "../design-agent-schemas"
import type { FontScaleStep, RegionConstraint, TypographyScale } from "./types"

export type TypographyInput = {
  content: string
  regionBox: { width: number; height: number }
  constraint?: RegionConstraint
  importance?: RegionImportance
  alignment?: RegionAlignment
  typography: TypographyScale
  isHeading: boolean
}

export type TypographyOutput = {
  fontSize: number
  lineHeight: number
  fontWeight: string
  textAlign: RegionAlignment
  estimatedLines: number
  width: number
}

const SCALE_ORDER: FontScaleStep[] = ["caption", "body", "h3", "h2", "h1", "hero"]

function scaleToPx(step: FontScaleStep, typography: TypographyScale): number {
  return typography[step]
}

function stepIndex(step: FontScaleStep): number {
  return SCALE_ORDER.indexOf(step)
}

function clampStep(step: FontScaleStep, min?: FontScaleStep, max?: FontScaleStep): FontScaleStep {
  let idx = stepIndex(step)
  if (min) idx = Math.max(idx, stepIndex(min))
  if (max) idx = Math.min(idx, stepIndex(max))
  return SCALE_ORDER[Math.max(0, Math.min(SCALE_ORDER.length - 1, idx))]!
}

function defaultStep(importance: RegionImportance | undefined, isHeading: boolean): FontScaleStep {
  if (importance === "primary") return isHeading ? "hero" : "h1"
  if (importance === "secondary") return isHeading ? "h2" : "body"
  if (importance === "tertiary") return "caption"
  return isHeading ? "h1" : "body"
}

function estimateCharsPerLine(fontSize: number, width: number): number {
  const avgCharWidth = fontSize * 0.52
  return Math.max(8, Math.floor(width / avgCharWidth))
}

export function resolveTypography(input: TypographyInput): TypographyOutput {
  const { content, regionBox, constraint, importance, alignment, typography, isHeading } = input
  const text = content.trim()
  const maxChars = constraint?.maxChars ?? (isHeading ? 72 : 160)
  const maxLines = constraint?.maxLines ?? (isHeading ? 3 : 4)
  const preferredLines = constraint?.preferredLineCount ?? maxLines

  let step = defaultStep(importance, isHeading)
  step = clampStep(step, constraint?.minFontScale, constraint?.maxFontScale)

  if (text.length > maxChars) {
    const over = text.length / maxChars
    const drop = over > 1.5 ? 2 : 1
    const idx = Math.max(0, stepIndex(step) - drop)
    step = SCALE_ORDER[idx]!
  }

  const minPx = constraint?.minFontScale ? scaleToPx(constraint.minFontScale, typography) : undefined
  const bodyFloor = isHeading ? typography.h2 : Math.max(typography.body, 18)

  let fontSize = scaleToPx(step, typography)
  let width = regionBox.width
  const charsPerLine = estimateCharsPerLine(fontSize, width)
  let estimatedLines = Math.max(1, Math.ceil(text.length / charsPerLine))

  while (estimatedLines > maxLines && stepIndex(step) > stepIndex("caption")) {
    const nextStep = SCALE_ORDER[stepIndex(step) - 1]!
    const nextSize = scaleToPx(nextStep, typography)
    if (minPx !== undefined && nextSize < minPx) break
    if (!isHeading && nextSize < bodyFloor) break
    step = nextStep
    fontSize = nextSize
    estimatedLines = Math.max(1, Math.ceil(text.length / estimateCharsPerLine(fontSize, width)))
  }

  if (minPx !== undefined) fontSize = Math.max(fontSize, minPx)
  if (!isHeading) fontSize = Math.max(fontSize, bodyFloor)

  if (estimatedLines > preferredLines && width < regionBox.width) {
    width = Math.min(regionBox.width, width * 1.15)
    estimatedLines = Math.max(1, Math.ceil(text.length / estimateCharsPerLine(fontSize, width)))
  }

  const lineHeight = isHeading
    ? fontSize >= typography.h1
      ? 0.95
      : 1.1
    : typography.body >= 18
      ? 1.5
      : 1.45

  const fontWeight = isHeading || importance === "primary" ? "700" : importance === "secondary" ? "600" : "normal"
  const textAlign: RegionAlignment = alignment ?? (isHeading ? "center" : "left")

  return {
    fontSize,
    lineHeight,
    fontWeight,
    textAlign,
    estimatedLines,
    width: Math.round(width),
  }
}

/** Ensure body text never exceeds headline scale; never shrink below compose sizes. */
export function enforceHierarchyScale(
  specs: Array<{ fontSize: number; isHeading: boolean }>,
): Array<{ fontSize: number }> {
  const headlines = specs.filter((s) => s.isHeading).map((s) => s.fontSize)
  const maxHeadline = headlines.length > 0 ? Math.max(...headlines) : Infinity
  return specs.map((s) => ({
    fontSize: s.isHeading
      ? s.fontSize
      : Math.min(Math.max(s.fontSize, 18), Math.floor(maxHeadline / 1.35)),
  }))
}
