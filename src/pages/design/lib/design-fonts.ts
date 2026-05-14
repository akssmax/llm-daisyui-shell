import { useEffect } from "react"
import { useDesignStore } from "../store/design-store"
import type { DesignDocument } from "../types"
import { safePageElements } from "./safe-page-elements"

/** Bundled via `@fontsource-variable/inter` in `index.css` — do not fetch from Google. */
const BUNDLED_LOCAL_FAMILIES = new Set(["inter variable"])

const GENERIC_KEYWORDS = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "inherit",
  "initial",
  "unset",
])

/** Map common LLM / design tokens to CSS families actually registered in this app. */
const PRIMARY_ALIAS: Record<string, string> = {
  inter: "Inter Variable",
}

const injectedGoogleLinks = new Set<string>()
/** Tracks successfully prepared Google Stylesheet hrefs (axis set may change over time). */
const loadedGoogleHrefs = new Set<string>()

const STATIC_WEIGHTS_100_900 = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/** Google Fonts CSS2 `ital,wght@…` axis: all common static weights × roman + italic (omitted faces are harmless). */
function googleFontsItalWghtAxisFullStatic(): string {
  const parts: string[] = []
  for (const w of STATIC_WEIGHTS_100_900) parts.push(`0,${w}`)
  for (const w of STATIC_WEIGHTS_100_900) parts.push(`1,${w}`)
  return parts.join(";")
}

/** Curated Google Fonts (CSS family names). Dynamic loader still runs for any name the model uses; this list is for UI pickers. */
export const CURATED_GOOGLE_FONT_FAMILIES: readonly string[] = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Merriweather",
  "Playfair Display",
  "Source Sans 3",
  "Work Sans",
  "DM Sans",
  "Space Grotesk",
  "Libre Baskerville",
  "Oswald",
  "Bebas Neue",
  "Fira Sans",
  "Rubik",
  "Ubuntu",
  "Noto Sans",
  "PT Sans",
  "Crimson Text",
  "Lora",
  "Quicksand",
  "Barlow",
  "Manrope",
  "JetBrains Mono",
  "IBM Plex Sans",
] as const

function stripQuotes(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim()
  }
  return t
}

/** First font in a CSS `font-family` stack (before first comma). */
export function primaryFamilyFromStack(fontFamilyStack: string): string {
  const raw = fontFamilyStack.split(",")[0] ?? ""
  return stripQuotes(raw) || "sans-serif"
}

/** Canonical primary name for dedupe / loading (aliases applied, lowercased for sets). */
export function canonicalPrimaryFamily(fontFamilyStack: string): string {
  const primary = primaryFamilyFromStack(fontFamilyStack)
  const alias = PRIMARY_ALIAS[primary.toLowerCase()]
  return alias ?? primary
}

/**
 * Full `font-family` string for Konva / canvas: normalize the first face, keep useful fallbacks.
 */
export function fontFamilyForKonva(fontFamilyStack: string): string {
  const primary = primaryFamilyFromStack(fontFamilyStack)
  const rest = fontFamilyStack
    .split(",")
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean)
  const resolvedPrimary = PRIMARY_ALIAS[primary.toLowerCase()] ?? primary
  const fallbacks = rest.length > 0 ? rest.join(", ") : "system-ui, sans-serif"
  return `${resolvedPrimary}, ${fallbacks}`
}

/** Quote multi-word families for `font-family` in HTML/CSS `style=""` attributes. */
export function fontFamilyForHtmlCss(fontFamilyStack: string): string {
  const resolved = fontFamilyForKonva(fontFamilyStack)
  return resolved
    .split(",")
    .map((part) => {
      const t = part.trim()
      if (!t) return ""
      if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t
      if (/\s/.test(t)) return `"${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      return t
    })
    .filter(Boolean)
    .join(", ")
}

export const CUSTOM_FONT_SENTINEL = "__design_custom_font__"

/** Curated `<link rel="stylesheet">` hrefs so exported HTML can render Google faces (incl. portable load for bundled Inter → Google Inter). */
export function googleFontStylesheetHrefsForExport(doc: DesignDocument): string[] {
  const hrefs: string[] = []
  const seen = new Set<string>()
  const push = (family: string) => {
    const href = googleFontsStylesheetUrl(family)
    if (seen.has(href)) return
    seen.add(href)
    hrefs.push(href)
  }
  for (const c of collectDocumentFontPrimaries(doc)) {
    const lower = c.toLowerCase()
    if (GENERIC_KEYWORDS.has(lower)) continue
    if (lower === "inter variable") {
      push("Inter")
      continue
    }
    if (BUNDLED_LOCAL_FAMILIES.has(lower)) continue
    push(c)
  }
  return hrefs
}

export function stackFromCuratedGoogleFamily(family: string): string {
  return `${family}, system-ui, sans-serif`
}

/** Match `fontFamily` stack to a curated option, or `CUSTOM_FONT_SENTINEL` when the primary is not in the curated list. */
export function curatedFontSelectValue(fontFamilyStack: string): string {
  const raw = primaryFamilyFromStack(fontFamilyStack)
  const canon = canonicalPrimaryFamily(fontFamilyStack)
  const hit = CURATED_GOOGLE_FONT_FAMILIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase() || canonicalPrimaryFamily(c) === canon,
  )
  return hit ?? CUSTOM_FONT_SENTINEL
}

function shouldSkipGoogleFetch(canonicalPrimary: string): boolean {
  const p = canonicalPrimary.trim()
  if (!p) return true
  if (BUNDLED_LOCAL_FAMILIES.has(p.toLowerCase())) return true
  if (GENERIC_KEYWORDS.has(p.toLowerCase())) return true
  return false
}

function googleFontsStylesheetUrl(family: string): string {
  const name = family.trim().replace(/\s+/g, "+")
  const axis = googleFontsItalWghtAxisFullStatic()
  return `https://fonts.googleapis.com/css2?family=${name}:ital,wght@${axis}&display=swap`
}

function linkIdForFamily(family: string): string {
  return `design-google-font-${family.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80)}`
}

function waitForLinkLoad(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve, reject) => {
    link.addEventListener("load", () => resolve(), { once: true })
    link.addEventListener("error", () => reject(new Error(`Failed to load stylesheet: ${link.href}`)), { once: true })
  })
}

/** Expand a `FontFace` weight (incl. variable ranges) into discrete steps for UI. */
export function expandFontFaceWeightToSteps(weight: string): number[] {
  const s = String(weight).trim().toLowerCase()
  if (s === "normal") return [400]
  if (s === "bold") return [700]
  const rangeMatch = s.match(/^(\d+)\s+(\d+)$/)
  if (rangeMatch) {
    const a = Number(rangeMatch[1])
    const b = Number(rangeMatch[2])
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [400]
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    return STATIC_WEIGHTS_100_900.filter((n) => n >= lo && n <= hi)
  }
  const n = Number(s)
  return Number.isFinite(n) ? [Math.min(900, Math.max(100, Math.round(n)))] : [400]
}

/**
 * Reads loaded `FontFace` entries for a canonical family (after Google CSS / local fonts registered).
 * Used to populate weight / italic options. Falls back to common steps when nothing is registered yet.
 */
export function collectLoadedFontWeightCatalog(canonicalFamily: string): { roman: number[]; italic: number[] } {
  const target = canonicalFamily.trim().toLowerCase()
  const fallbackRoman = [...STATIC_WEIGHTS_100_900]
  const fallbackItalic = [...STATIC_WEIGHTS_100_900]
  if (!target || shouldSkipGoogleFetch(canonicalFamily)) {
    return { roman: fallbackRoman, italic: fallbackItalic }
  }

  const roman = new Set<number>()
  const italic = new Set<number>()

  try {
    for (const face of document.fonts.values()) {
      if (face.family.trim().toLowerCase() !== target) continue
      const expanded = expandFontFaceWeightToSteps(String(face.weight))
      if (face.style === "italic") {
        for (const n of expanded) italic.add(n)
      } else {
        for (const n of expanded) roman.add(n)
      }
    }
  } catch {
    return { roman: fallbackRoman, italic: fallbackItalic }
  }

  if (roman.size === 0 && italic.size === 0) {
    return { roman: fallbackRoman, italic: fallbackItalic }
  }

  const sortUnique = (s: Set<number>) => [...s].sort((a, b) => a - b)
  return {
    roman: roman.size ? sortUnique(roman) : fallbackRoman,
    italic: italic.size ? sortUnique(italic) : [],
  }
}

/**
 * Injects Google Fonts CSS once per family and waits for `document.fonts`.
 * No-op for bundled (Inter Variable) and generic CSS keywords.
 * Custom fonts later: extend with `registerDesignCustomFont` + shared registry check.
 */
export async function ensureGoogleFontLoaded(canonicalPrimary: string): Promise<void> {
  const key = canonicalPrimary.trim()
  if (!key || shouldSkipGoogleFetch(key)) return

  const href = googleFontsStylesheetUrl(key)
  if (loadedGoogleHrefs.has(href)) {
    await document.fonts.ready.catch(() => {})
    return
  }

  if (!injectedGoogleLinks.has(href)) {
    const id = linkIdForFamily(key)
    const existing = document.getElementById(id) as HTMLLinkElement | null
    if (existing?.tagName === "LINK" && existing.href !== href) {
      existing.href = href
      try {
        await waitForLinkLoad(existing)
      } catch {
        await document.fonts.ready.catch(() => {})
      }
    } else if (!existing) {
      const link = document.createElement("link")
      link.id = id
      link.rel = "stylesheet"
      link.href = href
      link.crossOrigin = "anonymous"
      document.head.appendChild(link)
      try {
        await waitForLinkLoad(link)
      } catch {
        await document.fonts.ready.catch(() => {})
      }
    }
    injectedGoogleLinks.add(href)
  }

  await document.fonts.ready.catch(() => {})

  loadedGoogleHrefs.add(href)
}

export function collectDocumentFontPrimaries(doc: DesignDocument): string[] {
  const set = new Set<string>()
  const add = (stack: string) => {
    const c = canonicalPrimaryFamily(stack)
    if (c) set.add(c)
  }
  const themeStack = typeof doc.theme?.fontFamily === "string" ? doc.theme.fontFamily : ""
  if (themeStack) add(themeStack)
  const pages = Array.isArray(doc.pages) ? doc.pages : []
  for (const page of pages) {
    for (const el of safePageElements(page)) {
      if (el.kind === "text" && typeof el.fontFamily === "string") add(el.fontFamily)
    }
  }
  return [...set]
}

function fontFingerprint(doc: DesignDocument): string {
  return collectDocumentFontPrimaries(doc).sort().join("|")
}

/**
 * Loads all font families referenced by the design document (theme + text layers).
 * Bumps `fontEpoch` in the design store when done so Konva can `batchDraw`.
 */
export function useDesignDocumentFonts(document: DesignDocument | null): void {
  const bumpFontEpoch = useDesignStore((s) => s.bumpFontEpoch)
  const key = document ? fontFingerprint(document) : ""

  useEffect(() => {
    if (!key) return
    const doc = useDesignStore.getState().document
    if (!doc) return
    let cancelled = false

    const run = async () => {
      const families = collectDocumentFontPrimaries(doc)
      for (const family of families) {
        if (cancelled) return
        try {
          await ensureGoogleFontLoaded(family)
        } catch (e) {
          console.warn("[design-fonts] Failed to load font:", family, e)
        }
      }
      if (!cancelled) bumpFontEpoch()
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [key, bumpFontEpoch])
}

/** Future: register @font-face + `FontFace` for user uploads; merge into `ensureGoogleFontLoaded` path. */
export type DesignCustomFontRegistration = {
  family: string
  /** CSS url() value or data URL */
  src: string
}

export function registerDesignCustomFont(_reg: DesignCustomFontRegistration): void {
  void _reg
  // Stub for custom fonts — implement FontFace + document.fonts.add when needed.
}
