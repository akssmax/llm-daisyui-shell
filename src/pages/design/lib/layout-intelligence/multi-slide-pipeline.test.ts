import { describe, expect, it } from "vitest"
import { parseIntentPlan } from "../design-agent-schemas"
import { assembleMultiSlideDocument } from "./multi-slide-assembler"
import { runFullQualityPipeline } from "./design-auto-fix"
import { getLayoutById, layoutPatternToLayoutTree, tokenPresetToBundle } from "./layout-catalog"
import { buildTailwindTokenBundle } from "./tailwind-theme-builder"
import {
  inferSlideCountFromMessage,
  inferSlidesToAdd,
  inferTargetSlideIndex,
  mergeEditedPageIntoDocument,
  shouldRunIntelligencePipeline,
} from "./slide-utils"

describe("slide count inference", () => {
  it("infers slides to add from 'create 4 more slides'", () => {
    expect(inferSlidesToAdd("create 4 more slides")).toBe(4)
    expect(inferSlidesToAdd("add 3 more pages")).toBe(3)
  })

  it("infers carousel slide count from message", () => {
    expect(inferSlideCountFromMessage("5-slide LinkedIn carousel")).toBe(5)
    expect(inferSlideCountFromMessage("make a carousel")).toBe(5)
  })
})

describe("multi-slide quality pipeline", () => {
  it("preserves page count after runFullQualityPipeline", () => {
    const pattern = getLayoutById("li-carousel-hero-centered")
    expect(pattern).toBeDefined()
    const intent = parseIntentPlan({
      intent: {
        designType: "carousel",
        tone: "professional",
        platform: "linkedin",
        density: "normal",
        contentPriority: ["headline"],
        audience: "founders",
      },
      plan: {
        layoutType: "hero-centered",
        visualHierarchy: ["headline"],
        grid: { columns: 12, safeMargin: 64 },
        spacingStrategy: { baseUnit: 8, sectionGap: 48 },
        slideCount: 3,
      },
    })!
    const tokens = tokenPresetToBundle(buildTailwindTokenBundle({ accentHue: "indigo", mode: "light" }))
    const layout = layoutPatternToLayoutTree(pattern!)
    const slideCount = 3
    const slides = Array.from({ length: slideCount }, (_, i) => [
      { regionId: "headline", content: `Slide ${i + 1} headline` },
    ])
    const doc = assembleMultiSlideDocument(
      layout,
      { slides, slideCount },
      {
        intentPlan: intent,
        tokens: tokens as never,
        userMessage: "3 slide carousel",
        documentType: "carousel",
      },
    )
    expect(doc.pages.length).toBe(3)

    const { document: refined } = runFullQualityPipeline(doc, {
      safeMargin: 64,
      tokenPreset: buildTailwindTokenBundle({ accentHue: "indigo", mode: "light" }),
    })
    expect(refined.pages.length).toBe(3)
    expect(refined.pages[0]?.elements.length).toBeGreaterThan(0)
    expect(refined.pages[1]?.elements.length).toBeGreaterThan(0)
    expect(refined.pages[2]?.elements.length).toBeGreaterThan(0)
  })
})

describe("inferTargetSlideIndex", () => {
  it("parses slide/page targets (1-based → 0-based)", () => {
    expect(inferTargetSlideIndex("in slide 6, create a cover letter")).toBe(5)
    expect(inferTargetSlideIndex("on page 3 update the headline")).toBe(2)
    expect(inferTargetSlideIndex("edit slide 2")).toBe(1)
  })

  it("does not treat carousel slide counts as edit targets", () => {
    expect(inferTargetSlideIndex("make a 6-slide LinkedIn carousel")).toBeNull()
    expect(inferTargetSlideIndex("5-slide carousel")).toBeNull()
  })
})

describe("mergeEditedPageIntoDocument", () => {
  it("replaces the target page and keeps others", () => {
    const existing = {
      id: "doc1",
      title: "t",
      type: "carousel" as const,
      createdAt: "",
      updatedAt: "",
      theme: {
        primaryColor: "#000",
        secondaryColor: "#666",
        accentColor: "#6366F1",
        backgroundColor: "#fff",
        fontFamily: "Inter",
      },
      pages: [
        {
          id: "p0",
          width: 1080,
          height: 1080,
          backgroundColor: "#fff",
          elements: [
            {
              kind: "text" as const,
              id: "a",
              x: 0,
              y: 0,
              width: 100,
              height: 20,
              rotation: 0,
              zIndex: 1,
              opacity: 1,
              content: "keep",
              fontFamily: "Inter",
              fontSize: 18,
              fontWeight: "normal",
              fontStyle: "normal" as const,
              color: "#000",
              textAlign: "left" as const,
              lineHeight: 1.4,
            },
          ],
        },
        { id: "p1", width: 1080, height: 1080, backgroundColor: "#fff", elements: [] },
      ],
    }
    const merged = mergeEditedPageIntoDocument(existing as import("../../types").DesignDocument, 1, {
      id: "gen",
      width: 816,
      height: 1056,
      backgroundColor: "#f5f5f5",
      elements: [
        {
          kind: "text",
          id: "b",
          x: 0,
          y: 0,
          width: 100,
          height: 20,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          content: "new",
          fontFamily: "Inter",
          fontSize: 18,
          fontWeight: "normal",
          fontStyle: "normal",
          color: "#000",
          textAlign: "left",
          lineHeight: 1.4,
        },
      ],
    })
    const el0 = merged.pages[0]?.elements[0]
    const el1 = merged.pages[1]?.elements[0]
    expect(el0?.kind === "text" && el0.content).toBe("keep")
    expect(el1?.kind === "text" && el1.content).toBe("new")
    expect(merged.pages[1]?.id).toBe("p1")
    expect(merged.pages[1]?.width).toBe(816)
  })

  it("appends when target index is beyond current page count", () => {
    const existing = {
      id: "doc1",
      title: "t",
      type: "carousel" as const,
      createdAt: "",
      updatedAt: "",
      theme: {
        primaryColor: "#000",
        secondaryColor: "#666",
        accentColor: "#6366F1",
        backgroundColor: "#fff",
        fontFamily: "Inter",
      },
      pages: [{ id: "p0", width: 1080, height: 1080, backgroundColor: "#fff", elements: [] }],
    }
    const merged = mergeEditedPageIntoDocument(existing as import("../../types").DesignDocument, 2, {
      id: "gen",
      width: 1080,
      height: 1080,
      backgroundColor: "#fff",
      elements: [
        {
          kind: "text",
          id: "b",
          x: 0,
          y: 0,
          width: 100,
          height: 20,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          content: "slide3",
          fontFamily: "Inter",
          fontSize: 18,
          fontWeight: "normal",
          fontStyle: "normal",
          color: "#000",
          textAlign: "left",
          lineHeight: 1.4,
        },
      ],
    })
    expect(merged.pages.length).toBe(3)
    const el2 = merged.pages[2]?.elements[0]
    expect(el2?.kind === "text" && el2.content).toBe("slide3")
  })
})

describe("shouldRunIntelligencePipeline", () => {
  it("routes add-slide and targeted-edit requests to intelligence", () => {
    expect(shouldRunIntelligencePipeline("create 4 more slides", false)).toBe(true)
    expect(shouldRunIntelligencePipeline("change the headline color", false)).toBe(false)
    expect(shouldRunIntelligencePipeline("in slide 6, create a cover letter", false, 5)).toBe(true)
    expect(shouldRunIntelligencePipeline("in slide 6, create a cover letter", false, 0)).toBe(false)
  })
})
