import { describe, expect, it } from "vitest"
import {
  konvaFontStyleFromTextElement,
  normalizeFontWeightToNumber,
  snapFontWeightToAllowed,
} from "./design-text-style"

describe("normalizeFontWeightToNumber", () => {
  it("maps keywords and clamps", () => {
    expect(normalizeFontWeightToNumber("normal")).toBe(400)
    expect(normalizeFontWeightToNumber("bold")).toBe(700)
    expect(normalizeFontWeightToNumber("600")).toBe(600)
    expect(normalizeFontWeightToNumber("950")).toBe(900)
    expect(normalizeFontWeightToNumber("50")).toBe(100)
  })
})

describe("konvaFontStyleFromTextElement", () => {
  it("matches legacy bold / italic combinations and numeric weights", () => {
    expect(konvaFontStyleFromTextElement({ fontWeight: "normal", fontStyle: "normal" })).toBe("normal")
    expect(konvaFontStyleFromTextElement({ fontWeight: "normal", fontStyle: "italic" })).toBe("italic")
    expect(konvaFontStyleFromTextElement({ fontWeight: "bold", fontStyle: "normal" })).toBe("700")
    expect(konvaFontStyleFromTextElement({ fontWeight: "bold", fontStyle: "italic" })).toBe("italic 700")
    expect(konvaFontStyleFromTextElement({ fontWeight: "600", fontStyle: "normal" })).toBe("600")
    expect(konvaFontStyleFromTextElement({ fontWeight: "600", fontStyle: "italic" })).toBe("italic 600")
  })
})

describe("snapFontWeightToAllowed", () => {
  it("picks nearest allowed weight", () => {
    expect(snapFontWeightToAllowed("600", [400, 700])).toBe("700")
    expect(snapFontWeightToAllowed("normal", [300, 500])).toBe("300")
  })
})
