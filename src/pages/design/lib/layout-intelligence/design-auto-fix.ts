import type { DesignDocument, DesignElement, DesignPage } from "../../types"
import type { CritiqueIssue, DesignTokensPreset } from "./types"
import { critiqueDesign, CRITIC_AUTO_FIX_MAX, passesCriticGate } from "./design-critic"
import { getTokenPresetById } from "./layout-catalog"
import { runColorPass, type ColorPassOptions } from "./passes/color-pass"
import { runSpacingPass } from "./passes/spacing-pass"
import { runTypographyPass } from "./passes/typography-pass"

const GRID = 8

function snap8(n: number): number {
  return Math.round(n / GRID) * GRID
}

export type QualityPipelineOptions = {
  safeMargin?: number
  tokenPresetId?: string
  tokenPreset?: DesignTokensPreset
  enforceTailwindOnly?: boolean
}

function colorPassOpts(opts?: QualityPipelineOptions): ColorPassOptions {
  return {
    tokenPresetId: opts?.tokenPresetId,
    tokenPreset: opts?.tokenPreset ?? (opts?.tokenPresetId ? getTokenPresetById(opts.tokenPresetId) : undefined),
    enforceTailwindOnly: opts?.enforceTailwindOnly,
  }
}

function applyIssueFix(el: DesignElement, issue: CritiqueIssue, tokens?: DesignTokensPreset): DesignElement {
  if (el.kind === "icon") {
    if (issue.type === "contrast" && tokens) {
      return { ...el, color: tokens.colors.accent }
    }
    if (issue.type === "alignment") {
      return { ...el, x: snap8(el.x), y: snap8(el.y), width: snap8(el.width), height: snap8(el.height) }
    }
    return el
  }

  if (el.kind !== "text") {
    if (issue.type === "alignment") {
      return { ...el, x: snap8(el.x), y: snap8(el.y), width: snap8(el.width), height: snap8(el.height) }
    }
    return el
  }

  let next = { ...el }

  if (issue.type === "hierarchy" && issue.severity === "high") {
    next = { ...next, fontSize: Math.min(next.fontSize + 16, 96), fontWeight: "700" }
  }
  if (issue.type === "contrast" && tokens) {
    next = { ...next, color: tokens.colors.textPrimary }
  }
  if (issue.type === "readability" && next.textAlign === "center" && next.content.length > 80) {
    next = { ...next, textAlign: "left" }
  }
  if (issue.type === "alignment") {
    next = {
      ...next,
      x: snap8(next.x),
      y: snap8(next.y),
      width: snap8(next.width),
      height: snap8(next.height),
    }
  }

  return next
}

/** Run typography, spacing, and color passes on a single page. */
export function applyPassesToPage(page: DesignPage, opts?: QualityPipelineOptions): DesignPage {
  const colorOpts = colorPassOpts(opts)
  let elements = page.elements ?? []
  elements = runTypographyPass(elements, opts?.tokenPresetId)
  elements = runSpacingPass(elements, page.width, page.height)
  elements = runColorPass(elements, page.backgroundColor, colorOpts)
  return { ...page, elements }
}

function applyPassesToAllPages(doc: DesignDocument, opts?: QualityPipelineOptions): DesignDocument {
  return {
    ...doc,
    pages: doc.pages.map((p) => applyPassesToPage(p, opts)),
    updatedAt: new Date().toISOString(),
  }
}

function refinePageElements(
  page: DesignPage,
  critique: ReturnType<typeof critiqueDesign>,
  opts: QualityPipelineOptions | undefined,
  tokenPreset: DesignTokensPreset | undefined,
): DesignPage {
  const colorOpts = colorPassOpts(opts)
  const pageElementIds = new Set((page.elements ?? []).map((el) => el.id))
  const pageIssues = critique.issues.filter(
    (i) => i.severity !== "low" && (i.elementIds ?? []).some((id) => pageElementIds.has(id)),
  )

  let elements = page.elements ?? []

  if (pageIssues.length > 0) {
    const issueIds = new Set(pageIssues.flatMap((i) => i.elementIds ?? []))
    elements = elements.map((el) => {
      if (!issueIds.has(el.id)) return el
      const relevant = pageIssues.filter((i) => i.elementIds?.includes(el.id))
      return relevant.reduce((acc, iss) => applyIssueFix(acc, iss, tokenPreset), el)
    })
  }

  elements = runTypographyPass(elements, opts?.tokenPresetId)
  elements = runSpacingPass(elements, page.width, page.height)
  elements = runColorPass(elements, page.backgroundColor, colorOpts)

  if (pageIssues.some((i) => i.type === "overcrowding" && i.severity === "high")) {
    const textEls = elements.filter((e) => e.kind === "text")
    const sorted = [...textEls].sort((a, b) =>
      a.kind === "text" && b.kind === "text" ? a.fontSize - b.fontSize : 0,
    )
    const dropId = sorted[0]?.id
    if (dropId && elements.length > 4) {
      elements = elements.filter((e) => e.id !== dropId)
    }
  }

  return { ...page, elements }
}

export function autoFixDocument(
  doc: DesignDocument,
  opts?: QualityPipelineOptions & { maxIterations?: number },
): { document: DesignDocument; critique: ReturnType<typeof critiqueDesign>; iterations: number } {
  const maxIter = opts?.maxIterations ?? CRITIC_AUTO_FIX_MAX
  const tokenPreset =
    opts?.tokenPreset ?? (opts?.tokenPresetId ? getTokenPresetById(opts.tokenPresetId) : undefined)
  let current = doc
  let critique = critiqueDesign(current, opts)
  let iterations = 0

  while (!passesCriticGate(critique) && iterations < maxIter) {
    iterations++
    if (current.pages.length === 0) break

    const pages = current.pages.map((page) => refinePageElements(page, critique, opts, tokenPreset))

    current = {
      ...current,
      pages,
      updatedAt: new Date().toISOString(),
    }
    critique = critiqueDesign(current, opts)
  }

  return { document: current, critique, iterations }
}

export function runFullQualityPipeline(
  doc: DesignDocument,
  opts?: QualityPipelineOptions,
): { document: DesignDocument; critique: ReturnType<typeof critiqueDesign> } {
  if (doc.pages.length === 0) {
    return { document: doc, critique: critiqueDesign(doc, opts) }
  }

  const withPasses = applyPassesToAllPages(doc, opts)
  return autoFixDocument(withPasses, opts)
}
