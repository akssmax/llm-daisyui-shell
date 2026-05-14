import { describe, expect, it } from "vitest"
import { safePageElements } from "./safe-page-elements"
import type { DesignElement } from "../types"

const sample: DesignElement = {
  kind: "text",
  id: "t1",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  zIndex: 1,
  opacity: 1,
  content: "x",
  fontFamily: "Inter",
  fontSize: 12,
  fontWeight: "normal",
  fontStyle: "normal",
  color: "#000",
  textAlign: "left",
  lineHeight: 1.4,
}

describe("safePageElements", () => {
  it("returns empty array when elements missing or not an array", () => {
    expect(safePageElements({})).toEqual([])
    expect(safePageElements({ elements: null })).toEqual([])
    expect(safePageElements({ elements: {} as unknown as DesignElement[] })).toEqual([])
  })

  it("returns the same array reference when valid", () => {
    const els = [sample]
    expect(safePageElements({ elements: els })).toBe(els)
  })
})
