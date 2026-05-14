import { describe, expect, it } from "vitest"
import type { DesignDocument } from "../types"
import { validateDesignDocument, deterministicRepairElements } from "./design-validate"

const minimalDoc = (): DesignDocument => ({
  id: "doc12345",
  title: "T",
  type: "slide",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  theme: {
    primaryColor: "#6366F1",
    secondaryColor: "#1E293B",
    accentColor: "#F59E0B",
    backgroundColor: "#0F172A",
    fontFamily: "Inter",
  },
  pages: [
    {
      id: "p1",
      width: 1080,
      height: 1080,
      backgroundColor: "#0F172A",
      elements: [
        {
          kind: "text",
          id: "t1",
          x: 10,
          y: 10,
          width: 200,
          height: 40,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          content: "Hi",
          fontFamily: "Inter",
          fontSize: 14,
          fontWeight: "400",
          fontStyle: "normal",
          color: "#F8FAFC",
          textAlign: "left",
          lineHeight: 1.4,
        },
      ],
    },
  ],
})

describe("validateDesignDocument", () => {
  it("flags small body text", () => {
    const doc = minimalDoc()
    const r = validateDesignDocument(doc, { safeMargin: 64 })
    expect(r.issues.some((i) => i.type === "text_size")).toBe(true)
  })

  it("passes after deterministic repair font size", () => {
    const doc = minimalDoc()
    const page = doc.pages[0]!
    const fixed = {
      ...doc,
      pages: [{ ...page, elements: deterministicRepairElements(page.elements) }],
    }
    const r = validateDesignDocument(fixed, { safeMargin: 64 })
    expect(r.issues.filter((i) => i.type === "text_size")).toHaveLength(0)
  })
})
