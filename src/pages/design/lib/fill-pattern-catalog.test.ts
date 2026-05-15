import { describe, expect, it } from "vitest"
import { getPatternTile, PATTERN_IDS, PATTERN_TILE_SIZE, parsePatternId } from "./fill-pattern-catalog"

describe("fill-pattern-catalog", () => {
  it("parses pattern aliases", () => {
    expect(parsePatternId("grid-light")).toBe("grid-light")
    expect(parsePatternId("dotted")).toBe("dots")
    expect(parsePatternId("unknown")).toBeNull()
  })

  it("returns a tile canvas for each pattern id when DOM is available", () => {
    if (typeof document === "undefined") return
    for (const id of PATTERN_IDS) {
      const tile = getPatternTile(id, "#6366F1", "#ffffff")
      expect(tile).not.toBeNull()
      expect(tile!.width).toBe(PATTERN_TILE_SIZE)
      expect(tile!.height).toBe(PATTERN_TILE_SIZE)
    }
  })
})
