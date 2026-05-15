import { describe, expect, it } from "vitest"
import {
  CANVAS_FORMATS,
  documentMatchesCanvasSpec,
  inferCanvasFromMessage,
  resolveCanvasSpec,
  shouldApplyCanvasSpecToDocument,
  userRequestsCanvasResize,
} from "./canvas-spec"
import type { DesignDocument } from "../../types"
import type { IntentPlanPayload } from "../design-agent-schemas"

describe("canvas-spec", () => {
  it("infers A4 resume dimensions from prompt", () => {
    const spec = inferCanvasFromMessage("Design a resume in A4 format for a software engineer")
    expect(spec.format).toBe("resume")
    expect(spec.width).toBe(CANVAS_FORMATS.resume.width)
    expect(spec.height).toBe(CANVAS_FORMATS.resume.height)
    expect(spec.documentType).toBe("document")
  })

  it("infers cover letter dimensions", () => {
    const spec = inferCanvasFromMessage("Create a cover letter for an engineering role")
    expect(spec.format).toBe("cover-letter")
    expect(spec.documentType).toBe("document")
  })

  it("infers invoice dimensions from prompt", () => {
    const spec = inferCanvasFromMessage("design an invoice in purple theme for PhonePe")
    expect(spec.format).toBe("invoice")
    expect(spec.width).toBe(CANVAS_FORMATS.invoice.width)
    expect(spec.documentType).toBe("document")
  })

  it("infers receipt dimensions", () => {
    const spec = inferCanvasFromMessage("make a thermal receipt for a coffee shop")
    expect(spec.format).toBe("receipt")
  })

  it("infers LinkedIn 1:1 square from prompt", () => {
    const spec = inferCanvasFromMessage("linkedin canvas is 1:1, use that canvas size")
    expect(spec.width).toBe(1080)
    expect(spec.height).toBe(1080)
  })
})

describe("canvas resize helpers", () => {
  const portraitDoc: DesignDocument = {
    id: "d1",
    title: "Deck",
    type: "carousel",
    createdAt: "",
    updatedAt: "",
    theme: {
      primaryColor: "#000",
      secondaryColor: "#333",
      accentColor: "#6366f1",
      backgroundColor: "#fff",
      fontFamily: "Inter",
    },
    pages: [
      { id: "p1", width: 1080, height: 1350, backgroundColor: "#fff", elements: [] },
      { id: "p2", width: 1080, height: 1350, backgroundColor: "#fff", elements: [] },
    ],
  }

  const squareSpec = CANVAS_FORMATS["instagram-post"]

  it("detects canvas resize requests", () => {
    expect(userRequestsCanvasResize("linkedin canvas is 1:1, use that canvas size")).toBe(true)
    expect(userRequestsCanvasResize("make the headline purple")).toBe(false)
  })

  it("should apply when dimensions differ and user asked", () => {
    expect(
      shouldApplyCanvasSpecToDocument(portraitDoc, squareSpec, "linkedin canvas is 1:1, use that canvas size"),
    ).toBe(true)
    expect(documentMatchesCanvasSpec(portraitDoc, squareSpec)).toBe(false)
  })

  it("should not apply on unrelated edits", () => {
    expect(shouldApplyCanvasSpecToDocument(portraitDoc, squareSpec, "make the headline purple")).toBe(
      false,
    )
  })

  it("uses locked preset when not auto", () => {
    const spec = resolveCanvasSpec({
      userMessage: "design a resume",
      presetKey: "instagram-post",
    })
    expect(spec.width).toBe(1080)
    expect(spec.height).toBe(1080)
  })

  it("uses intent plan canvas when auto", () => {
    const intent: IntentPlanPayload = {
      intent: {
        designType: "resume",
        tone: "professional",
        platform: "print",
        density: "normal",
        contentPriority: ["headline"],
        audience: "hiring managers",
      },
      plan: {
        layoutType: "document",
        visualHierarchy: ["headline", "body"],
        grid: { columns: 12, safeMargin: 48 },
        spacingStrategy: { baseUnit: 8, sectionGap: 24 },
        canvas: {
          width: 794,
          height: 1123,
          format: "a4-portrait",
          documentType: "document",
        },
      },
    }
    const spec = resolveCanvasSpec({
      userMessage: "resume",
      intent,
      presetKey: "auto",
    })
    expect(spec.width).toBe(794)
    expect(spec.height).toBe(1123)
  })
})
