import { describe, expect, it } from "vitest"
import { collectDocumentFontPrimaries } from "./design-fonts"
import type { DesignDocument } from "../types"

const minimalDoc = (overrides: Partial<DesignDocument> & { pages?: DesignDocument["pages"] }): DesignDocument =>
  ({
    id: "doc123456",
    title: "T",
    type: "slide",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    theme: {
      primaryColor: "#000",
      secondaryColor: "#111",
      accentColor: "#222",
      backgroundColor: "#fff",
      fontFamily: "Inter",
    },
    pages: [
      {
        id: "p1",
        width: 100,
        height: 100,
        backgroundColor: "#fff",
        elements: [],
      },
    ],
    ...overrides,
  }) as DesignDocument

describe("collectDocumentFontPrimaries", () => {
  it("does not throw when page.elements is missing", () => {
    const pages = [{ id: "p1", width: 100, height: 100, backgroundColor: "#fff" }] as DesignDocument["pages"]
    const doc = minimalDoc({ pages })
    expect(() => collectDocumentFontPrimaries(doc)).not.toThrow()
    expect(collectDocumentFontPrimaries(doc)).toContain("Inter Variable")
  })

  it("does not throw when pages is missing", () => {
    const doc = minimalDoc({ pages: undefined as unknown as DesignDocument["pages"] })
    expect(() => collectDocumentFontPrimaries(doc)).not.toThrow()
    expect(collectDocumentFontPrimaries(doc)).toContain("Inter Variable")
  })

  it("collects text element fonts", () => {
    const doc = minimalDoc({
      pages: [
        {
          id: "p1",
          width: 100,
          height: 100,
          backgroundColor: "#fff",
          elements: [
            {
              kind: "text",
              id: "t1",
              x: 0,
              y: 0,
              width: 50,
              height: 20,
              rotation: 0,
              zIndex: 1,
              opacity: 1,
              content: "Hi",
              fontFamily: "Roboto, sans-serif",
              fontSize: 14,
              fontWeight: "normal",
              fontStyle: "normal",
              color: "#000",
              textAlign: "left",
              lineHeight: 1.4,
            },
          ],
        },
      ],
    })
    const families = collectDocumentFontPrimaries(doc)
    expect(families.some((f) => f.toLowerCase().includes("roboto"))).toBe(true)
  })
})
