import type { DesignDocument, DesignElement } from "../types"
import { safePageElements } from "./safe-page-elements"

export type DesignValidationIssue = {
  id: string
  type:
    | "bounds"
    | "overlap"
    | "grid"
    | "margin"
    | "element_limit"
    | "text_size"
    | "contrast"
  message: string
  elementIds?: string[]
  pageId?: string
}

export type DesignValidationResult = {
  valid: boolean
  issues: DesignValidationIssue[]
  /** 0–100 quality score from soft issues (overlap, margin, contrast, etc.) */
  qualityScore?: number
}

const GRID = 8
const MAX_ELEMENTS = 8
const MIN_BODY_PX = 16

function snap8(n: number): number {
  return Math.round(n / GRID) * GRID
}

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

function contrastRatio(a: string, b: string): number {
  const L1 = luminance(a) + 0.05
  const L2 = luminance(b) + 0.05
  return L1 > L2 ? L1 / L2 : L2 / L1
}

function aabbOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number,
): boolean {
  return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y)
}

/** Deterministic fixes: snap to 8px grid, clamp within page bounds, enforce min font size. */
export function deterministicRepairElements(
  elements: DesignElement[],
  pageDimensions?: { width: number; height: number },
): DesignElement[] {
  const pw = pageDimensions?.width ?? Infinity
  const ph = pageDimensions?.height ?? Infinity
  return elements.map((el) => {
    // Snap raw values first.
    let x = snap8(el.x)
    let y = snap8(el.y)
    let w = Math.max(8, snap8(el.width))
    let h = Math.max(8, snap8(el.height))

    // Clamp width/height so element fits inside page.
    if (Number.isFinite(pw)) w = Math.min(w, pw)
    if (Number.isFinite(ph)) h = Math.min(h, ph)

    // Clamp x/y so right/bottom edge stays inside page.
    if (Number.isFinite(pw)) x = Math.max(0, Math.min(x, pw - w))
    if (Number.isFinite(ph)) y = Math.max(0, Math.min(y, ph - h))

    const base = { ...el, x, y, width: w, height: h }
    if (el.kind === "text") {
      return { ...base, fontSize: Math.max(MIN_BODY_PX, el.fontSize) }
    }
    return base
  })
}

export function validateDesignDocument(doc: DesignDocument, opts?: { safeMargin?: number }): DesignValidationResult {
  const safeMargin = opts?.safeMargin ?? 64
  const issues: DesignValidationIssue[] = []

  for (const page of doc.pages) {
    const els = safePageElements(page)
    if (els.length > MAX_ELEMENTS) {
      issues.push({
        id: `limit-${page.id}`,
        type: "element_limit",
        message: `Page has ${els.length} elements (max recommended ${MAX_ELEMENTS}).`,
        pageId: page.id,
      })
    }

    const boxes: { id: string; x: number; y: number; w: number; h: number }[] = []

    for (const el of els) {
      const right = el.x + el.width
      const bottom = el.y + el.height
      if (el.x < 0 || el.y < 0 || right > page.width || bottom > page.height) {
        issues.push({
          id: `bounds-${el.id}`,
          type: "bounds",
          message: `Element ${el.id} extends outside the artboard.`,
          elementIds: [el.id],
          pageId: page.id,
        })
      }
      if (el.x < safeMargin || el.y < safeMargin || page.width - right < safeMargin || page.height - bottom < safeMargin) {
        issues.push({
          id: `margin-${el.id}`,
          type: "margin",
          message: `Element ${el.id} is closer than ${safeMargin}px to an artboard edge.`,
          elementIds: [el.id],
          pageId: page.id,
        })
      }
      for (const k of [el.x, el.y, el.width, el.height]) {
        if (Math.abs(k % GRID) > 0.001 && Math.abs(k % GRID - GRID) > 0.001) {
          issues.push({
            id: `grid-${el.id}`,
            type: "grid",
            message: `Element ${el.id} uses values not aligned to ${GRID}px grid.`,
            elementIds: [el.id],
            pageId: page.id,
          })
          break
        }
      }

      if (el.kind === "text" && el.fontSize < MIN_BODY_PX) {
        issues.push({
          id: `text-${el.id}`,
          type: "text_size",
          message: `Text ${el.id} uses fontSize ${el.fontSize}px (minimum ${MIN_BODY_PX}px).`,
          elementIds: [el.id],
          pageId: page.id,
        })
      }

      if (el.kind === "text") {
        const bg = page.backgroundColor
        const ratio = contrastRatio(el.color, bg)
        if (ratio < 3) {
          issues.push({
            id: `contrast-${el.id}`,
            type: "contrast",
            message: `Text ${el.id} may have low contrast (${ratio.toFixed(2)}:1) vs page background.`,
            elementIds: [el.id],
            pageId: page.id,
          })
        }
      }

      boxes.push({ id: el.id, x: el.x, y: el.y, w: el.width, h: el.height })
    }

    const gap = 8
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i]!
        const B = boxes[j]!
        if (aabbOverlap(A, B, gap)) {
          issues.push({
            id: `overlap-${A.id}-${B.id}`,
            type: "overlap",
            message: `Elements ${A.id} and ${B.id} overlap or are tighter than ${gap}px.`,
            elementIds: [A.id, B.id],
            pageId: page.id,
          })
        }
      }
    }
  }

  // Only out-of-artboard elements are hard failures that block the canvas apply.
  const hard = issues.filter((i) => i.type === "bounds")
  const soft = issues.filter((i) => i.type !== "bounds")
  let qualityPenalty = 0
  for (const i of soft) {
    qualityPenalty +=
      i.type === "overlap" || i.type === "contrast" ? 15 : i.type === "margin" ? 10 : 5
  }
  const qualityScore = Math.max(0, 100 - qualityPenalty)

  return { valid: hard.length === 0, issues, qualityScore }
}
