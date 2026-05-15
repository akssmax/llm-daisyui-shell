import { describe, expect, it } from "vitest"
import { buildContentProfile } from "./content-profile"
import { selectLayoutForContent } from "./layout-fit-scorer"
import type { IntentPlanPayload } from "../design-agent-schemas"

const intentPlan: IntentPlanPayload = {
  intent: {
    designType: "linkedin-carousel",
    tone: "professional",
    platform: "linkedin",
    density: "normal",
    contentPriority: ["headline", "body"],
    audience: "founders",
  },
  plan: {
    layoutType: "carousel",
    visualHierarchy: ["headline", "body", "visual"],
    grid: { columns: 12, safeMargin: 64 },
    spacingStrategy: { baseUnit: 8, sectionGap: 48 },
    slideCount: 5,
  },
}

describe("selectLayoutForContent", () => {
  it("prefers li-carousel-split for 5-slide carousel profile", () => {
    const slides = Array.from({ length: 5 }, () => [
      { regionId: "headline", content: "Your Browser, Now with Superpowers" },
      { regionId: "body", content: "Tired of switching between 10 tools? The 100x Agent is a free Chrome extension." },
      { regionId: "visual", content: "icon kind=zap" },
      { regionId: "footer", content: "Add to Chrome (Free) →" },
    ])
    const profile = buildContentProfile(slides, 5)
    const result = selectLayoutForContent({
      intentPlan,
      userPrompt: "5 slide linkedin carousel for chrome extension",
      profile,
      memorySignals: { layoutScores: {} },
      pageDims: { w: 1080, h: 1350 },
      banditContextKey: "test:carousel",
    })
    expect(result.layoutId).toBe("li-carousel-split")
    expect(result.ranked[0]?.contentFitScore).toBeGreaterThan(50)
  })
})
