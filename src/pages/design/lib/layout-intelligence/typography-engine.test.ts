import { describe, expect, it } from "vitest"
import { resolveTypography, enforceHierarchyScale } from "./typography-engine"

const typography = {
  hero: 72,
  h1: 56,
  h2: 40,
  h3: 32,
  body: 20,
  caption: 16,
}

describe("resolveTypography", () => {
  it("scales down long headline content", () => {
    const long = "A".repeat(100)
    const short = resolveTypography({
      content: "Short title",
      regionBox: { width: 400, height: 120 },
      typography,
      isHeading: true,
      importance: "primary",
      constraint: { maxChars: 72, maxLines: 3 },
    })
    const longResult = resolveTypography({
      content: long,
      regionBox: { width: 400, height: 120 },
      typography,
      isHeading: true,
      importance: "primary",
      constraint: { maxChars: 72, maxLines: 3 },
    })
    expect(longResult.fontSize).toBeLessThanOrEqual(short.fontSize)
  })

  it("uses region alignment", () => {
    const result = resolveTypography({
      content: "Centered",
      regionBox: { width: 300, height: 80 },
      typography,
      isHeading: true,
      alignment: "center",
    })
    expect(result.textAlign).toBe("center")
  })
})

describe("enforceHierarchyScale", () => {
  it("caps body below headline", () => {
    const adjusted = enforceHierarchyScale([
      { fontSize: 56, isHeading: true },
      { fontSize: 48, isHeading: false },
    ])
    expect(adjusted[1]!.fontSize).toBeLessThan(adjusted[0]!.fontSize)
  })
})
