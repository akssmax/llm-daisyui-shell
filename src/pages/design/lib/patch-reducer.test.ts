import { describe, expect, it } from "vitest"
import { applyPatch } from "../store/patch-reducer"
import type { DesignDocument, TextElement } from "../types"

const textEl: TextElement = {
  kind: "text",
  id: "t1",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  rotation: 0,
  zIndex: 1,
  opacity: 1,
  content: "Hi",
  fontFamily: "Inter",
  fontSize: 18,
  fontWeight: "normal",
  fontStyle: "normal",
  color: "#000",
  textAlign: "left",
  lineHeight: 1.4,
}

const baseDoc: DesignDocument = {
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
      width: 800,
      height: 600,
      backgroundColor: "#fff",
      elements: [textEl],
    },
  ],
}

describe("applyPatch", () => {
  it("create_element appends on matching page", () => {
    const next = applyPatch(baseDoc, {
      op: "create_element",
      pageId: "p1",
      element: { ...textEl, id: "t2", zIndex: 2 },
    })
    expect(next.pages[0]?.elements).toHaveLength(2)
    expect(next.pages[0]?.elements.map((e) => e.id)).toEqual(["t1", "t2"])
  })

  it("update_element merges patch", () => {
    const next = applyPatch(baseDoc, {
      op: "update_element",
      pageId: "p1",
      elementId: "t1",
      patch: { content: "Bye" },
    })
    const el = next.pages[0]?.elements[0]
    expect(el && el.kind === "text" && el.content).toBe("Bye")
  })

  it("delete_element removes by id", () => {
    const next = applyPatch(baseDoc, { op: "delete_element", pageId: "p1", elementId: "t1" })
    expect(next.pages[0]?.elements).toHaveLength(0)
  })

  it("reorder_element sets zIndex", () => {
    const next = applyPatch(baseDoc, {
      op: "reorder_element",
      pageId: "p1",
      elementId: "t1",
      zIndex: 99,
    })
    expect(next.pages[0]?.elements[0]?.zIndex).toBe(99)
  })
})
