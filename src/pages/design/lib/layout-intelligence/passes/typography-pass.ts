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

  const sorted = [...textEls].sort((a, b) => b.fontSize - a.fontSize)
  const sizes = [scale.hero, scale.h1, scale.h2, scale.h3, scale.body, scale.caption]

  const sizeById = new Map<string, number>()
  sorted.forEach((el, idx) => {
    sizeById.set(el.id, sizes[Math.min(idx, sizes.length - 1)] ?? scale.body)
  })

  const headingFont = preset?.headingFont ?? "Inter"
  const bodyFont = preset?.bodyFont ?? "Inter"

  return elements.map((el) => {
    if (el.kind !== "text") return el
    const newSize = sizeById.get(el.id) ?? el.fontSize
    const isHeading = newSize >= scale.h2
    return {
      ...el,
      fontSize: newSize,
      fontFamily: isHeading ? headingFont : bodyFont,
      fontWeight: isHeading ? "700" : el.fontWeight === "700" ? "600" : el.fontWeight,
      lineHeight: isHeading ? (preset?.rules.lineHeight.hero ?? 1.15) : (preset?.rules.lineHeight.body ?? 1.5),
    }
  })
}
