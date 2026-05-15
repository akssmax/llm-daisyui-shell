import type { DesignElement, DesignPage } from "../../types"
import type { CritiqueIssue, DesignTokensPreset } from "./types"

const GRID = 8
const MIN_MARGIN = 64

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0.5
  const n = Number.parseInt(m[1]!, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: string, b: string): number {
  const L1 = luminance(a) + 0.05
  const L2 = luminance(b) + 0.05
  return L1 > L2 ? L1 / L2 : L2 / L1
}

export function collectCompositionIssues(
  page: DesignPage,
  tokens?: DesignTokensPreset,
): CritiqueIssue[] {
  const issues: CritiqueIssue[] = []
  const elements = page.elements ?? []
  const textEls = elements.filter((e): e is Extract<DesignElement, { kind: "text" }> => e.kind === "text")

  const fonts = new Set(textEls.map((e) => e.fontFamily))
  if (fonts.size > 2) {
    issues.push({
      type: "readability",
      severity: "medium",
      message: "More than 2 font families used",
    })
  }

  const weights = new Set(textEls.map((e) => e.fontWeight))
  if (weights.size > 3) {
    issues.push({
      type: "readability",
      severity: "low",
      message: "More than 3 font weights used",
    })
  }

  const sorted = [...textEls].sort((a, b) => b.fontSize - a.fontSize)
  if (sorted.length >= 2) {
    const headline = sorted[0]!
    const sub = sorted[1]!
    if (headline.fontSize < sub.fontSize * 1.25) {
      issues.push({
        type: "hierarchy",
        severity: "high",
        message: "Headline lacks dominance over subheading",
        elementIds: [headline.id],
      })
    }
    if (sorted.length >= 3) {
      const body = sorted[sorted.length - 1]!
      if (headline.fontSize < body.fontSize * 1.5) {
        issues.push({
          type: "hierarchy",
          severity: "medium",
          message: "Insufficient scale between headline and body",
          elementIds: [headline.id, body.id],
        })
      }
    }
  }

  for (const el of textEls) {
    if (el.textAlign === "center" && el.fontSize < 32 && el.content.length > 80) {
      issues.push({
        type: "readability",
        severity: "medium",
        message: "Long centered body text hurts readability",
        elementIds: [el.id],
      })
    }
    const ratio = contrastRatio(el.color, page.backgroundColor)
    const minContrast = tokens?.rules.contrastMin ?? 4.5
    if (ratio < minContrast) {
      issues.push({
        type: "contrast",
        severity: ratio < 3 ? "high" : "medium",
        message: `Low contrast (${ratio.toFixed(1)}:1) for text`,
        elementIds: [el.id],
      })
    }
  }

  for (const el of elements) {
    if (el.x < MIN_MARGIN || el.y < MIN_MARGIN) {
      issues.push({
        type: "spacing",
        severity: "medium",
        message: `Element too close to top/left edge (<${MIN_MARGIN}px)`,
        elementIds: [el.id],
      })
    }
    const right = page.width - (el.x + el.width)
    const bottom = page.height - (el.y + el.height)
    if (right < MIN_MARGIN || bottom < MIN_MARGIN) {
      issues.push({
        type: "spacing",
        severity: "medium",
        message: `Element too close to bottom/right edge`,
        elementIds: [el.id],
      })
    }
    for (const k of [el.x, el.y, el.width, el.height]) {
      if (Math.abs(k % GRID) > 0.5 && Math.abs(k % GRID - GRID) > 0.5) {
        issues.push({
          type: "alignment",
          severity: "low",
          message: "Element not aligned to 8px grid",
          elementIds: [el.id],
        })
        break
      }
    }
  }

  if (elements.length > 7) {
    issues.push({
      type: "overcrowding",
      severity: "high",
      message: `Too many elements (${elements.length})`,
    })
  }

  const leftEdges = elements.map((e) => e.x)
  const uniqueLeft = new Set(leftEdges.map((x) => Math.round(x / GRID) * GRID))
  if (uniqueLeft.size > 4 && elements.length <= 6) {
    issues.push({
      type: "alignment",
      severity: "medium",
      message: "Inconsistent left alignment across elements",
    })
  }

  const areas = elements.map((e) => e.width * e.height)
  const totalArea = page.width * page.height
  const used = areas.reduce((s, a) => s + a, 0)
  if (used / totalArea > 0.75) {
    issues.push({
      type: "balance",
      severity: "high",
      message: "Composition feels overcrowded — insufficient whitespace",
    })
  }

  return issues
}

export function scoreFromIssues(issues: CritiqueIssue[], category: CritiqueIssue["type"]): number {
  const relevant = issues.filter((i) => i.type === category)
  let penalty = 0
  for (const i of relevant) {
    penalty += i.severity === "high" ? 25 : i.severity === "medium" ? 12 : 5
  }
  return Math.max(0, 100 - penalty)
}
