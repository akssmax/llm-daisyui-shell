import type { TextElement } from "../types"

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Normal",
  500: "Medium",
  600: "Semi bold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
}

const STANDARD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/** Numeric CSS `font-weight` for canvas / inline styles / export. */
export function normalizeFontWeightToNumber(weight: string | undefined | null): number {
  const w = String(weight ?? "400").trim().toLowerCase()
  if (w === "normal") return 400
  if (w === "bold") return 700
  const n = Number(w)
  if (!Number.isFinite(n)) return 400
  return Math.min(900, Math.max(100, Math.round(n)))
}

/** CSS `font-weight` value as string (number string or keyword). */
export function normalizeFontWeightToCssString(weight: string | undefined | null): string {
  const n = normalizeFontWeightToNumber(weight)
  const raw = String(weight ?? "").trim().toLowerCase()
  if (raw === "normal" && n === 400) return "normal"
  if (raw === "bold" && n === 700) return "bold"
  return String(n)
}

export function fontWeightOptionLabel(n: number): string {
  const name = WEIGHT_LABELS[n]
  return name ? `${name} (${n})` : String(n)
}

export function standardWeightStepsInRange(minW: number, maxW: number): number[] {
  return STANDARD_WEIGHTS.filter((n) => n >= minW && n <= maxW)
}

/**
 * Konva `Text` only has `fontStyle`; it is concatenated with `fontVariant` and `fontSize` to build the canvas font string.
 * Use explicit numeric weights so arbitrary weights (e.g. 600) render correctly.
 */
export function konvaFontStyleFromTextElement(el: Pick<TextElement, "fontWeight" | "fontStyle">): string {
  const w = normalizeFontWeightToNumber(el.fontWeight)
  const italic = el.fontStyle === "italic"
  if (italic && w === 400) return "italic"
  if (!italic && w === 400) return "normal"
  if (italic) return `italic ${w}`
  return String(w)
}

/** `<textarea style={{ fontWeight, fontStyle }}>` — separate properties, CSS numeric weights. */
export function htmlTextareaFontWeight(weight: string | undefined | null): string {
  return normalizeFontWeightToCssString(weight)
}

export function snapFontWeightToAllowed(weight: string | undefined | null, allowed: number[]): string {
  const n = normalizeFontWeightToNumber(weight)
  if (allowed.includes(n)) return String(n)
  if (!allowed.length) return "400"
  const nearest = allowed.reduce((best, w) => (Math.abs(w - n) < Math.abs(best - n) ? w : best))
  return String(nearest)
}
