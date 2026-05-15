import { describe, expect, it } from "vitest"
import { CANVAS_FORMATS, inferCanvasFromMessage, resolveCanvasSpec } from "./canvas-spec"
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
