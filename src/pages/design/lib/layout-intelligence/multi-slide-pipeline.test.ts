import { describe, expect, it } from "vitest"
import { parseIntentPlan } from "../design-agent-schemas"
import { assembleMultiSlideDocument } from "./multi-slide-assembler"
import { runFullQualityPipeline } from "./design-auto-fix"
import { getLayoutById, layoutPatternToLayoutTree, tokenPresetToBundle } from "./layout-catalog"
import { buildTailwindTokenBundle } from "./tailwind-theme-builder"
import { inferSlideCountFromMessage, inferSlidesToAdd } from "./slide-utils"

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

describe("shouldRunIntelligencePipeline", () => {
  it("routes add-slide requests to intelligence", async () => {
    const { shouldRunIntelligencePipeline } = await import("./slide-utils")
    expect(shouldRunIntelligencePipeline("create 4 more slides", false)).toBe(true)
    expect(shouldRunIntelligencePipeline("change the headline color", false)).toBe(false)
  })
})
