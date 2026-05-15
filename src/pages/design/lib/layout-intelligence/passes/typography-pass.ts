import type { DesignElement } from "../../../types"
import { getTokenPresetById } from "../layout-catalog"

export function runTypographyPass(
  elements: DesignElement[],
  tokenPresetId?: string,
): DesignElement[] {
  const preset = tokenPresetId ? getTokenPresetById(tokenPresetId) : undefined
  const scale = preset?.typography ?? {
    hero: 72,
    h1: 56,
    h2: 40,
    h3: 32,
    body: 20,
    caption: 16,
  }

  const textEls = elements.filter((e): e is Extract<DesignElement, { kind: "text" }> => e.kind === "text")
  if (textEls.length === 0) return elements

  const maxFont = Math.max(...textEls.map((e) => e.fontSize))
  const headingFont = preset?.headingFont ?? "Inter"
  const bodyFont = preset?.bodyFont ?? "Inter"
  const maxLineWidth = preset?.rules.maxLineWidth
  const bodyMin = Math.max(scale.body, 18)

  return elements.map((el) => {
    if (el.kind !== "text") return el
    const isHeading = el.fontSize >= scale.h2 || el.fontSize >= maxFont * 0.85
    const floor = isHeading ? scale.h3 : bodyMin
    const newSize = Math.max(el.fontSize, floor)
    const clampedWidth =
      maxLineWidth !== undefined ? Math.min(el.width, maxLineWidth) : el.width
    return {
      ...el,
      fontSize: newSize,
      width: snap8(clampedWidth),
      fontFamily: isHeading ? headingFont : bodyFont,
      fontWeight: isHeading ? "700" : el.fontWeight === "700" ? "600" : el.fontWeight,
      lineHeight: isHeading
        ? (preset?.rules.lineHeight.hero ?? 1.15)
        : (preset?.rules.lineHeight.body ?? 1.5),
    }
  })
}

function snap8(n: number): number {
  return Math.round(n / 8) * 8
}
