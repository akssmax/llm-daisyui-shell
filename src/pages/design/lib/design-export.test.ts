import { describe, expect, it } from "vitest"
import { computeRasterExportPixelRatio } from "./design-export"

describe("computeRasterExportPixelRatio", () => {
  it("boosts ratio when stage is zoomed out", () => {
    const r = computeRasterExportPixelRatio({ devicePixelRatio: 2, fitScale: 0.5, userZoom: 0.8 })
    expect(r).toBeGreaterThanOrEqual(1)
    expect(r).toBeLessThanOrEqual(4)
  })

  it("clamps to at least 1", () => {
    expect(
      computeRasterExportPixelRatio({ devicePixelRatio: 1, fitScale: 1, userZoom: 1 }),
    ).toBe(1)
  })
})
