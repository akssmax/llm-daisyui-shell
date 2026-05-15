import { nanoid } from "nanoid"
import type { DesignDocument, DesignElement, Theme } from "../types"
import type { DesignTokenBundle, IntentPlanPayload, LayoutRegion, LayoutTree } from "./design-agent-schemas"
import { coerceElement, tryParseDesignCandidate } from "./design-json-parser"
import { parseContentMap, parseJsonObjectFromModel } from "./design-agent-schemas"
import { planComposition } from "./layout-intelligence/composition-planner"
import { getTokenPresetById } from "./layout-intelligence/layout-catalog"

const PAGE_W = 1080
const PAGE_H = 1080

function snap8(n: number): number {
  return Math.round(n / 8) * 8
}

function themeFromTokens(tokens: DesignTokenBundle): Theme {
  const c = tokens.tokens.colors
  return {
    primaryColor: c.accent ?? c.textPrimary ?? "#6366F1",
    secondaryColor: c.surface ?? "#64748B",
    accentColor: c.accent ?? "#6366F1",
    backgroundColor: c.background ?? "#FFFFFF",
    fontFamily: tokens.tokens.bodyFont ?? "Inter",
  }
}

export type AssembleDocumentOptions = {
  intentPlan: IntentPlanPayload
  tokens: DesignTokenBundle
  title?: string
  pageId?: string
  pageWidth?: number
  pageHeight?: number
  tokenPresetId?: string
}

/** Build a full DesignDocument shell from a flat elements array (elements-only compose). */
export function assembleDocumentFromElements(
  rawElements: unknown[],
  opts: AssembleDocumentOptions,
): DesignDocument {
  const margin = opts.intentPlan.plan.grid.safeMargin ?? 64
  const pw = opts.pageWidth ?? PAGE_W
  const ph = opts.pageHeight ?? PAGE_H
  const pageId = opts.pageId ?? `pg${nanoid(6)}`
  const now = new Date().toISOString()

  const elements: DesignElement[] = rawElements
    .map((el, idx) => coerceElement(el, idx))
    .filter((el): el is DesignElement => el !== null)
    .map((el) => clampElementToPage(el, pw, ph, margin))

  const theme = themeFromTokens(opts.tokens)
  const bg = opts.tokens.tokens.colors.background ?? theme.backgroundColor

  return {
    id: `doc${nanoid(6)}`,
    title: opts.title ?? opts.intentPlan.intent.designType ?? "Design",
    type: "social-post",
    createdAt: now,
    updatedAt: now,
    theme,
    pages: [
      {
        id: pageId,
        width: pw,
        height: ph,
        backgroundColor: bg,
        elements,
      },
    ],
  }
}

function clampElementToPage(el: DesignElement, pw: number, ph: number, margin: number): DesignElement {
  let w = Math.min(Math.max(8, snap8(el.width)), pw - margin * 2)
  let h = Math.min(Math.max(8, snap8(el.height)), ph - margin * 2)
  let x = snap8(Math.max(margin, Math.min(el.x, pw - margin - w)))
  let y = snap8(Math.max(margin, Math.min(el.y, ph - margin - h)))
  return { ...el, x, y, width: w, height: h }
}

export type RegionContent = {
  regionId: string
  content: string
  fontSize?: number
  fontWeight?: string
  textAlign?: "left" | "center" | "right"
  kind?: "text" | "shape" | "icon" | "silhouette"
  shapeName?: string
  fill?: string
  iconName?: string
  color?: string
}

/** Map layout regions (0–1 rects) to pixel boxes on the artboard. */
export function regionToPixelBox(
  region: LayoutRegion,
  pageWidth: number,
  pageHeight: number,
  safeMargin: number,
): { x: number; y: number; width: number; height: number } {
  const innerW = pageWidth - safeMargin * 2
  const innerH = pageHeight - safeMargin * 2
  const r = region.relativeRect
  const x = snap8(safeMargin + Math.max(0, Math.min(1, r.x)) * innerW)
  const y = snap8(safeMargin + Math.max(0, Math.min(1, r.y)) * innerH)
  const w = snap8(Math.max(8, Math.min(innerW, r.w) * innerW))
  const h = snap8(Math.max(8, Math.min(innerH, r.h) * innerH))
  return {
    x: Math.min(x, pageWidth - safeMargin - 8),
    y: Math.min(y, pageHeight - safeMargin - 8),
    width: Math.min(w, pageWidth - x - safeMargin),
    height: Math.min(h, pageHeight - y - safeMargin),
  }
}

/** Render a composition plan into Konva-ready elements. */
export function renderCompositionPlan(
  plan: import("./layout-intelligence/composition-planner").CompositionPlan,
): DesignElement[] {
  const elements: DesignElement[] = []
  let z = 1
  for (const spec of plan.regions) {
    if (spec.kind === "icon") {
      elements.push({
        id: `el${nanoid(6)}`,
        kind: "icon",
        iconName: spec.iconName,
        color: spec.color,
        strokeWidth: spec.strokeWidth,
        x: spec.box.x,
        y: spec.box.y,
        width: spec.box.width,
        height: spec.box.height,
        rotation: 0,
        zIndex: z++,
        opacity: 1,
      })
    } else if (spec.kind === "silhouette") {
      elements.push({
        id: `el${nanoid(6)}`,
        kind: "silhouette",
        shapeName: spec.shapeName,
        color: spec.color,
        x: spec.box.x,
        y: spec.box.y,
        width: spec.box.width,
        height: spec.box.height,
        rotation: 0,
        zIndex: z++,
        opacity: 1,
      })
    } else if (spec.kind === "shape") {
      elements.push({
        id: `el${nanoid(6)}`,
        kind: "shape",
        shape: "rectangle",
        fill: spec.fill,
        ...(spec.patternFill ? { patternFill: spec.patternFill } : {}),
        x: spec.box.x,
        y: spec.box.y,
        width: spec.box.width,
        height: spec.box.height,
        rotation: 0,
        zIndex: z++,
        opacity: 1,
      })
    } else {
      elements.push({
        id: `el${nanoid(6)}`,
        kind: "text",
        content: spec.content,
        fontFamily: spec.fontFamily,
        fontSize: spec.fontSize,
        fontWeight: spec.fontWeight,
        fontStyle: "normal",
        color: spec.color,
        textAlign: spec.textAlign,
        lineHeight: spec.lineHeight,
        x: spec.box.x,
        y: spec.box.y,
        width: spec.box.width,
        height: spec.box.height,
        rotation: 0,
        zIndex: z++,
        opacity: 1,
      })
    }
  }
  return elements
}

/** Build elements from layout regions + per-region text/content from a compact LLM response. */
export function assembleDocumentFromRegionContents(
  layout: LayoutTree,
  contents: RegionContent[],
  opts: AssembleDocumentOptions,
): DesignDocument {
  const pw = opts.pageWidth ?? PAGE_W
  const ph = opts.pageHeight ?? PAGE_H
  const tokenPreset = opts.tokenPresetId ? getTokenPresetById(opts.tokenPresetId) : undefined

  const plan = planComposition({
    layout,
    contents,
    intentPlan: opts.intentPlan,
    tokens: opts.tokens,
    pageWidth: pw,
    pageHeight: ph,
    tokenPreset,
    constraints: layout.constraints,
  })

  const elements = renderCompositionPlan(plan)
  const doc = assembleDocumentFromElements(elements, { ...opts, pageWidth: pw, pageHeight: ph })
  if (plan.pagePattern && doc.pages[0]) {
    doc.pages[0] = {
      ...doc.pages[0],
      backgroundPattern: {
        patternId: plan.pagePattern.patternId,
        color: plan.pagePattern.color,
        backgroundColor: doc.pages[0].backgroundColor,
      },
    }
  }
  return doc
}

function extractElementsArray(obj: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(obj.elements)) return obj.elements
  if (obj.kind === "elements" && Array.isArray(obj.elements)) return obj.elements
  const doc = obj.document
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    const pages = (doc as Record<string, unknown>).pages
    if (Array.isArray(pages) && pages[0] && typeof pages[0] === "object") {
      const els = (pages[0] as Record<string, unknown>).elements
      if (Array.isArray(els)) return els
    }
  }
  return null
}

/** Parse elements-only compose: { elements: [...] } or { kind:"elements", elements:[...] }. */
export function parseElementsOnlyCompose(raw: string): DesignElement[] | null {
  const candidates: Record<string, unknown>[] = []
  const fromModel = parseJsonObjectFromModel(raw)
  if (fromModel && typeof fromModel === "object") candidates.push(fromModel as Record<string, unknown>)
  const parsed = tryParseDesignCandidate(raw)
  if (parsed?.kind === "document") {
    const els: DesignElement[] = []
    for (const p of parsed.document.pages) els.push(...(p.elements ?? []))
    if (els.length > 0) return els
  }
  try {
    const direct = JSON.parse(raw.trim()) as Record<string, unknown>
    candidates.push(direct)
  } catch {
    // ignore
  }
  for (const obj of candidates) {
    const arr = extractElementsArray(obj)
    if (!arr || arr.length === 0) continue
    const out = arr.map((el, i) => coerceElement(el, i)).filter((el): el is DesignElement => el !== null)
    if (out.length > 0) return out
  }
  return null
}

/** Parse hybrid compose: { regionContents: [{ regionId, content, ... }] }. */
export function parseRegionContentsCompose(raw: string): RegionContent[] | null {
  const candidates: Record<string, unknown>[] = []
  const fromModel = parseJsonObjectFromModel(raw)
  if (fromModel && typeof fromModel === "object") candidates.push(fromModel as Record<string, unknown>)
  try {
    candidates.push(JSON.parse(raw.trim()) as Record<string, unknown>)
  } catch {
    // ignore
  }
  for (const obj of candidates) {
    const parsed = parseContentMap(obj)
    if (parsed) return parsed as RegionContent[]
  }
  return null
}
