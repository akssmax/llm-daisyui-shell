import { describe, expect, it } from "vitest"
import { snapToDesignGrid } from "./design-snap"

describe("snapToDesignGrid", () => {
  it("returns value unchanged when disabled", () => {
    expect(snapToDesignGrid(13, false)).toBe(13)
  })

  it("snaps to 8px grid when enabled", () => {
    expect(snapToDesignGrid(13, true)).toBe(16)
    expect(snapToDesignGrid(12, true)).toBe(16)
    expect(snapToDesignGrid(16, true)).toBe(16)
  })
})
