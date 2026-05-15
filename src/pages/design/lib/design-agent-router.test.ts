import { describe, expect, it } from "vitest"
import { routeDesignAgentOperation, isStructuredDocumentRequest } from "./design-agent-router"
import type { DesignDocument } from "../types"

function docWithText(): DesignDocument {
  return {
    id: "doc1",
    title: "Test",
    type: "document",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    theme: {
      primaryColor: "#000",
      secondaryColor: "#333",
      accentColor: "#6366f1",
      backgroundColor: "#fff",
      fontFamily: "Inter",
    },
    pages: [
      {
        id: "p1",
        width: 794,
        height: 1123,
        backgroundColor: "#fff",
        elements: [
          {
            kind: "text",
            id: "t1",
            x: 64,
            y: 64,
            width: 200,
            height: 40,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: "Invoice",
            fontFamily: "Inter",
            fontSize: 24,
            fontWeight: "700",
            fontStyle: "normal",
            color: "#000",
            textAlign: "left",
            lineHeight: 1.2,
          },
        ],
      },
    ],
  }
}

describe("routeDesignAgentOperation", () => {
  it("routes empty canvas to design_create", () => {
    expect(routeDesignAgentOperation({ userMessage: "design an invoice", document: null })).toBe(
      "design_create",
    )
  })

  it("routes remix keyword to design_recompose_layout when document has elements", () => {
    expect(
      routeDesignAgentOperation({
        userMessage: "remix layout please",
        document: docWithText(),
      }),
    ).toBe("design_recompose_layout")
  })

  it("respects forcedOperation", () => {
    expect(
      routeDesignAgentOperation({
        userMessage: "change color",
        document: docWithText(),
        forcedOperation: "design_recompose_layout",
      }),
    ).toBe("design_recompose_layout")
  })

  it("routes edits to design_edit", () => {
    expect(
      routeDesignAgentOperation({
        userMessage: "make the headline purple",
        document: docWithText(),
      }),
    ).toBe("design_edit")
  })
})

describe("isStructuredDocumentRequest", () => {
  it("detects invoice prompts", () => {
    expect(isStructuredDocumentRequest("design an invoice for PhonePe")).toBe(true)
    expect(isStructuredDocumentRequest("make a poster")).toBe(false)
  })
})
