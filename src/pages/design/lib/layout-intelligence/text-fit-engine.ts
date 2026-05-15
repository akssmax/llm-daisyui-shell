import type { FontScaleStep, RegionConstraint, TypographyScale } from "./types"

export type TextFitInput = {
  content: string
  boxWidth: number
  boxHeight: number
  typography: TypographyScale
  isHeading: boolean
  constraint?: RegionConstraint
  initialFontSize: number
  lineHeightRatio: number
}

export type TextFitOutput = {
  fontSize: number
  lineHeight: number
  estimatedLines: number
}

function minPx(step: FontScaleStep | undefined, typography: TypographyScale): number {
  if (!step) return typography.caption
  return typography[step]
}

function maxPx(step: FontScaleStep | undefined, typography: TypographyScale): number {
  if (!step) return typography.hero
  return typography[step]
}

function estimateCharsPerLine(fontSize: number, width: number): number {
  const avgCharWidth = fontSize * 0.52
  return Math.max(8, Math.floor(width / avgCharWidth))
}

function estimateLines(text: string, fontSize: number, width: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  const cpl = estimateCharsPerLine(fontSize, width)
  let lines = 1
  let lineLen = 0
  for (const word of words) {
    const need = word.length + (lineLen > 0 ? 1 : 0)
    if (lineLen + need > cpl) {
      lines++
      lineLen = word.length
    } else {
      lineLen += need
    }
  }
  return lines
}

function lineHeightPx(fontSize: number, ratio: number): number {
  return fontSize * ratio
}

/** Shrink font until full copy fits in the region box (never truncates text). */
export function fitTextToRegion(input: TextFitInput): TextFitOutput {
  const { content, boxWidth, boxHeight, typography, isHeading, constraint, lineHeightRatio } =
    input
  const text = content.trim()
  const minSize = minPx(constraint?.minFontScale, typography)
  const maxSize = Math.min(
    input.initialFontSize,
    maxPx(constraint?.maxFontScale, typography),
    isHeading ? typography.hero : typography.body + 8,
  )

  let lo = minSize
  let hi = maxSize
  let best = minSize
  let bestLines = estimateLines(text, minSize, boxWidth)

  while (lo <= hi) {
    const mid = Math.round((lo + hi) / 2)
    const lines = estimateLines(text, mid, boxWidth)
    const totalHeight = lines * lineHeightPx(mid, lineHeightRatio)
    if (totalHeight <= boxHeight) {
      best = mid
      bestLines = lines
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return {
    fontSize: best,
    lineHeight: lineHeightRatio,
    estimatedLines: bestLines,
  }
}
