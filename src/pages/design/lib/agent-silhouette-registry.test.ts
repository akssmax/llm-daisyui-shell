import { describe, expect, it } from "vitest"
import {
  extractSilhouetteFromText,
  getSilhouettePathData,
  normalizeSilhouetteName,
} from "./agent-silhouette-registry"

describe("agent-silhouette-registry", () => {
  it("parses silhouette kind=Heart", () => {
    expect(extractSilhouetteFromText("silhouette kind=Heart")).toBe("Heart")
    expect(normalizeSilhouetteName("heart")).toBe("Heart")
  })

  it("returns path data for known shapes", () => {
    const path = getSilhouettePathData("Burst")
    expect(path).toBeTruthy()
    expect(path!.length).toBeGreaterThan(10)
  })
})
