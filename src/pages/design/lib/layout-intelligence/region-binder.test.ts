import { describe, expect, it } from "vitest"
import { getLayoutById } from "./layout-catalog"
import { bindRegionsToLayout } from "./region-binder"

describe("bindRegionsToLayout", () => {
  it("maps semantic regions onto li-carousel-split and parses icon kind", () => {
    const layout = getLayoutById("li-carousel-split")!
    const bound = bindRegionsToLayout(layout, [
      { regionId: "headline", content: "Zapier + Figma + Airtable—Inside Chrome" },
      { regionId: "body", content: "What if Chrome could replace your entire tool stack?" },
      { regionId: "visual", content: "icon kind=users" },
      { regionId: "footer", content: "Unify Your Tools Today →" },
    ])
    const visual = bound.find((r) => r.regionId === "visual")
    expect(visual?.kind).toBe("icon")
    expect(visual?.iconName).toBe("users")
    expect(bound.find((r) => r.regionId === "headline")?.content).toContain("Zapier")
  })
})
