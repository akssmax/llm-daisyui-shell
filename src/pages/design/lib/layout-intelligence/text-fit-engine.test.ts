import { describe, expect, it } from "vitest"
import { fitTextToRegion } from "./text-fit-engine"

const typography = { hero: 72, h1: 56, h2: 40, h3: 32, body: 20, caption: 16 }

describe("fitTextToRegion", () => {
  it("fits long headline without truncating content", () => {
    const headline = "Zapier + Figma + Airtable—Inside Chrome"
    const result = fitTextToRegion({
      content: headline,
      boxWidth: 397,
      boxHeight: 280,
      typography,
      isHeading: true,
      initialFontSize: 56,
      lineHeightRatio: 1.1,
    })
    expect(result.fontSize).toBeGreaterThanOrEqual(typography.h2)
    expect(result.estimatedLines).toBeLessThanOrEqual(4)
  })
})
