import { describe, expect, it } from "vitest"
import { getLayoutById } from "./layout-catalog"
import {
  truncateContentForConstraints,
  validateContentAgainstConstraints,
} from "./constraint-validator"

describe("constraint-validator", () => {
  it("flags overlong copy", () => {
    const pattern = getLayoutById("li-carousel-hero-centered")!
    const violations = validateContentAgainstConstraints(
      [{ regionId: "headline", content: "X".repeat(200) }],
      pattern.constraints,
    )
    expect(violations.length).toBeGreaterThan(0)
  })

  it("truncates content to maxChars", () => {
    const pattern = getLayoutById("li-carousel-hero-centered")!
    const truncated = truncateContentForConstraints(
      [{ regionId: "cta", content: "This call to action is way too long for the slot" }],
      pattern.constraints,
    )
    const max = pattern.constraints!.regions.cta!.maxChars!
    expect(truncated[0]!.content.length).toBeLessThanOrEqual(max + 1)
  })
})
