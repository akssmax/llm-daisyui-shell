import { collectDesignJsonCandidates } from "./design-json-parser"
import {
  normalizeAccentHue,
  normalizeThemeMode,
  parseTailwindThemeSelection,
} from "./layout-intelligence/tailwind-theme-builder"

/** Parse first JSON object from model output. */
export function parseJsonObjectFromModel(raw: string): unknown | null {
  const candidates = collectDesignJsonCandidates(raw)
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
    } catch {
      // continue
    }
  }
  return null
}

export type DesignIntent = {
  designType: string
  tone: string
  platform: string
  density: "minimal" | "normal" | "dense"
  contentPriority: string[]
  audience: string
}

export type DesignPlan = {
  layoutType: string
  visualHierarchy: string[]
  grid: { columns: number; safeMargin: number }
  spacingStrategy: { baseUnit: number; sectionGap: number }
  /** Number of slides/pages for carousels and decks (default 1). */
  slideCount?: number
}

export type DesignTokenBundle = {
  tokens: {
    colors: Record<string, string>
    radius: number
    spacingScale: number[]
    fontScale: number[]
    headingFont: string
    bodyFont: string
  }
}

export type LayoutRegion = {
  id: string
  role: string
  relativeRect: { x: number; y: number; w: number; h: number }
}

export type LayoutTree = {
  regions: LayoutRegion[]
}

export type IntentPlanPayload = {
  intent: DesignIntent
  plan: DesignPlan
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

function asDensity(v: unknown): DesignIntent["density"] {
  if (v === "minimal" || v === "normal" || v === "dense") return v
  return "normal"
}

export function parseIntentPlan(obj: unknown): IntentPlanPayload | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const intent = r.intent
  const plan = r.plan
  if (!intent || typeof intent !== "object" || !plan || typeof plan !== "object") return null
  const i = intent as Record<string, unknown>
  const p = plan as Record<string, unknown>
  if (
    !isNonEmptyString(i.designType) ||
    !isNonEmptyString(i.tone) ||
    !isNonEmptyString(i.platform) ||
    !Array.isArray(i.contentPriority) ||
    !i.contentPriority.every(isNonEmptyString) ||
    !isNonEmptyString(i.audience)
  ) {
    return null
  }
  const grid = p.grid
  const spacing = p.spacingStrategy
  if (!grid || typeof grid !== "object" || !spacing || typeof spacing !== "object") return null
  const g = grid as Record<string, unknown>
  const s = spacing as Record<string, unknown>
  if (typeof g.columns !== "number" || typeof g.safeMargin !== "number") return null
  if (typeof s.baseUnit !== "number" || typeof s.sectionGap !== "number") return null
  if (!Array.isArray(p.visualHierarchy) || !p.visualHierarchy.every(isNonEmptyString)) return null
  if (!isNonEmptyString(p.layoutType)) return null

  const slideCount =
    typeof p.slideCount === "number" && p.slideCount >= 1 ? Math.round(p.slideCount) : undefined

  return {
    intent: {
      designType: i.designType.trim(),
      tone: i.tone.trim(),
      platform: i.platform.trim(),
      density: asDensity(i.density),
      contentPriority: (i.contentPriority as string[]).map((x) => x.trim()),
      audience: i.audience.trim(),
    },
    plan: {
      layoutType: p.layoutType.trim(),
      visualHierarchy: (p.visualHierarchy as string[]).map((x) => x.trim()),
      grid: { columns: g.columns, safeMargin: g.safeMargin },
      spacingStrategy: { baseUnit: s.baseUnit, sectionGap: s.sectionGap },
      ...(slideCount !== undefined ? { slideCount } : {}),
    },
  }
}

export function parseTailwindThemeFromDesignSystem(obj: unknown): {
  accentHue: string
  mode: "light" | "dark"
} | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const direct = parseTailwindThemeSelection(r)
  if (direct) return direct
  const nested = parseTailwindThemeSelection(r.tailwindTheme)
  if (nested) return nested
  const ds = r.designSystem
  if (ds && typeof ds === "object") {
    const fromDs = parseTailwindThemeSelection(ds)
    if (fromDs) return fromDs
    const fromDsNested = parseTailwindThemeSelection((ds as Record<string, unknown>).tailwindTheme)
    if (fromDsNested) return fromDsNested
  }
  const accentHue = typeof r.accentHue === "string" ? r.accentHue : undefined
  const mode = typeof r.mode === "string" ? r.mode : undefined
  if (accentHue || mode) {
    return {
      accentHue: normalizeAccentHue(accentHue),
      mode: normalizeThemeMode(mode),
    }
  }
  return null
}

export function parseDesignSystem(obj: unknown): DesignTokenBundle | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const ds = r.designSystem
  if (!ds || typeof ds !== "object") return null
  const t = (ds as Record<string, unknown>).tokens
  if (!t || typeof t !== "object") return null
  const tok = t as Record<string, unknown>
  if (typeof tok.radius !== "number") return null
  if (!Array.isArray(tok.spacingScale) || !tok.spacingScale.every((n) => typeof n === "number")) return null
  if (!Array.isArray(tok.fontScale) || !tok.fontScale.every((n) => typeof n === "number")) return null
  if (!isNonEmptyString(tok.headingFont) || !isNonEmptyString(tok.bodyFont)) return null
  const colors = tok.colors
  if (!colors || typeof colors !== "object") return null
  const colorMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(colors as Record<string, unknown>)) {
    if (isNonEmptyString(v)) colorMap[k] = v.trim()
  }
  if (Object.keys(colorMap).length === 0) return null
  return {
    tokens: {
      colors: colorMap,
      radius: tok.radius,
      spacingScale: tok.spacingScale as number[],
      fontScale: tok.fontScale as number[],
      headingFont: tok.headingFont.trim(),
      bodyFont: tok.bodyFont.trim(),
    },
  }
}

export function parseLayoutSelect(obj: unknown): { layoutId: string } | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const id = typeof r.layoutId === "string" ? r.layoutId : typeof r.selectedLayoutId === "string" ? r.selectedLayoutId : ""
  if (!id.trim()) return null
  return { layoutId: id.trim() }
}

export type RegionContentPayload = {
  regionId: string
  content: string
  fontSize?: number
  fontWeight?: string
  textAlign?: "left" | "center" | "right"
  kind?: "text" | "shape" | "icon"
  fill?: string
  iconName?: string
  color?: string
}

export type SlideRegionContents = {
  slideIndex: number
  regionContents: RegionContentPayload[]
}

function parseRegionContentItem(item: unknown): RegionContentPayload | null {
  if (!item || typeof item !== "object") return null
  const o = item as Record<string, unknown>
  const regionId = typeof o.regionId === "string" ? o.regionId : typeof o.id === "string" ? o.id : ""
  if (!regionId) return null

  const kindRaw = o.kind
  const isIcon = kindRaw === "icon" || (typeof o.iconName === "string" && o.iconName.trim().length > 0)

  if (isIcon) {
    const iconName =
      typeof o.iconName === "string"
        ? o.iconName.trim()
        : typeof o.content === "string"
          ? o.content.trim()
          : ""
    if (!iconName) return null
    return {
      regionId,
      content: iconName,
      kind: "icon",
      iconName,
      ...(typeof o.color === "string" ? { color: o.color } : {}),
    }
  }

  const content = typeof o.content === "string" ? o.content : typeof o.text === "string" ? o.text : ""
  if (!content.trim()) return null

  return {
    regionId,
    content: content.trim(),
    ...(kindRaw === "text" || kindRaw === "shape" ? { kind: kindRaw } : {}),
    ...(typeof o.fontSize === "number" ? { fontSize: o.fontSize } : {}),
    ...(typeof o.fontWeight === "string" ? { fontWeight: o.fontWeight } : {}),
    ...(o.textAlign === "left" || o.textAlign === "center" || o.textAlign === "right"
      ? { textAlign: o.textAlign }
      : {}),
    ...(typeof o.fill === "string" ? { fill: o.fill } : {}),
  }
}

export function parseContentMapSlides(obj: unknown): {
  slides: SlideRegionContents[]
  slideCount: number
} | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const slidesRaw = r.slides
  if (!Array.isArray(slidesRaw) || slidesRaw.length === 0) return null

  const slides: SlideRegionContents[] = []
  for (const slide of slidesRaw) {
    if (!slide || typeof slide !== "object") continue
    const s = slide as Record<string, unknown>
    const slideIndex = typeof s.slideIndex === "number" ? s.slideIndex : slides.length
    const contents = s.regionContents
    if (!Array.isArray(contents)) continue
    const regionContents: RegionContentPayload[] = []
    for (const item of contents) {
      const parsed = parseRegionContentItem(item)
      if (parsed) regionContents.push(parsed)
    }
    if (regionContents.length > 0) {
      slides.push({ slideIndex, regionContents })
    }
  }

  if (slides.length === 0) return null
  const slideCount =
    typeof r.slideCount === "number" ? Math.max(r.slideCount, slides.length) : slides.length
  return { slides: slides.sort((a, b) => a.slideIndex - b.slideIndex), slideCount }
}

export function parseContentMap(obj: unknown): RegionContentPayload[] | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const arr = r.regionContents ?? (r.kind === "region_contents" ? r.regionContents : null)
  if (!Array.isArray(arr)) return null
  const out: RegionContentPayload[] = []
  for (const item of arr) {
    const parsed = parseRegionContentItem(item)
    if (parsed) out.push(parsed)
  }
  return out.length > 0 ? out : null
}

export function parseLayoutTree(obj: unknown): LayoutTree | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const layout = r.layout
  if (!layout || typeof layout !== "object") return null
  const regions = (layout as Record<string, unknown>).regions
  if (!Array.isArray(regions) || regions.length === 0) return null
  const out: LayoutRegion[] = []
  for (const reg of regions) {
    if (!reg || typeof reg !== "object") return null
    const o = reg as Record<string, unknown>
    const rr = o.relativeRect
    if (!isNonEmptyString(o.id) || !isNonEmptyString(o.role) || !rr || typeof rr !== "object") return null
    const q = rr as Record<string, unknown>
    if (typeof q.x !== "number" || typeof q.y !== "number" || typeof q.w !== "number" || typeof q.h !== "number") return null
    out.push({
      id: o.id.trim(),
      role: o.role.trim(),
      relativeRect: { x: q.x, y: q.y, w: q.w, h: q.h },
    })
  }
  return { regions: out }
}
