import { describe, expect, it } from "vitest"
import { collectIconPathSpecs, getLucideIconNode, isIconPathFilled } from "./lucide-icon-registry"

describe("lucide icon path specs", () => {
  it("sparkles paths are stroke-only (not filled blobs)", () => {
    const node = getLucideIconNode("sparkles")
    expect(node).toBeTruthy()
    const paths = collectIconPathSpecs(node!)
    expect(paths.length).toBeGreaterThan(0)
    for (const spec of paths) {
      expect(isIconPathFilled(spec)).toBe(false)
    }
  })
})
