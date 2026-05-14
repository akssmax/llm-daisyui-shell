import { describe, expect, it } from "vitest"
import { knowledgeBundleCharLength, retrieveDesignPatterns } from "./design-pattern-retrieval"

describe("retrieveDesignPatterns", () => {
  it("returns bounded text", () => {
    const out = retrieveDesignPatterns("linkedin hero carousel spacing", 2000)
    expect(out.length).toBeLessThanOrEqual(2005)
    expect(out.length).toBeGreaterThan(50)
  })

  it("bundle has content", () => {
    expect(knowledgeBundleCharLength()).toBeGreaterThan(100)
  })
})
