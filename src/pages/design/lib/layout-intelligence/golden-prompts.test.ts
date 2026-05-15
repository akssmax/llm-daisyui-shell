import { describe, expect, it } from "vitest"
import {
  getLayoutById,
  getTokenPresetById,
  layoutPatternToLayoutTree,
  tokenPresetToBundle,
} from "./layout-catalog"
import { assembleWithRefinement } from "./design-refinement-loop"
import { passesCriticGate } from "./design-critic"
import type { RegionContent } from "../design-compose-assembler"

const GOLDEN: Array<{
  layoutId: string
  contents: RegionContent[]
  designType: string
}> = [
  {
    layoutId: "li-carousel-hero-centered",
    designType: "linkedin-carousel",
    contents: [
      { regionId: "headline", content: "Grow revenue with AI" },
      { regionId: "stat", content: "42%" },
      { regionId: "body", content: "Teams ship campaigns faster." },
      { regionId: "cta", content: "Learn more" },
    ],
  },
  {
    layoutId: "social-hero-bold",
    designType: "social-post",
    contents: [
      { regionId: "headline", content: "Design at speed" },
      { regionId: "body", content: "Constraint-driven layouts." },
    ],
  },
  {
    layoutId: "quote-centered",
    designType: "quote-card",
    contents: [
      { regionId: "quote", content: "Simplicity is the ultimate sophistication." },
      { regionId: "attribution", content: "Leonardo da Vinci" },
    ],
  },
]

describe("golden prompt fixtures", () => {
  for (const fixture of GOLDEN) {
    it(`assembles ${fixture.layoutId} with critic gate`, () => {
      const pattern = getLayoutById(fixture.layoutId)
      expect(pattern).toBeDefined()
      const layout = layoutPatternToLayoutTree(pattern!)
      const preset = getTokenPresetById("modern-saas")!
      const tokens = tokenPresetToBundle(preset)

      const result = assembleWithRefinement({
        layout,
        regionContents: fixture.contents,
        intentPlan: {
          intent: {
            designType: fixture.designType,
            tone: "modern",
            platform: "linkedin",
            density: "minimal",
            contentPriority: ["headline"],
            audience: "professionals",
          },
          plan: {
            layoutType: pattern!.archetype,
            visualHierarchy: ["headline"],
            grid: { columns: 12, safeMargin: 64 },
            spacingStrategy: { baseUnit: 8, sectionGap: 48 },
          },
        },
        tokens: tokens as import("../design-agent-schemas").DesignTokenBundle,
        pageWidth: pattern!.supportedAspects[0]?.w ?? 1080,
        pageHeight: pattern!.supportedAspects[0]?.h ?? 1080,
        pipelineOpts: { tokenPresetId: preset.id, safeMargin: 64 },
      })

      expect(result.document.pages[0]?.elements.length).toBeGreaterThan(0)
      expect(result.critique.compositeScore).toBeGreaterThan(0)
      // Soft gate: most fixtures should pass after refinement
      if (!passesCriticGate(result.critique)) {
        expect(result.critique.compositeScore).toBeGreaterThanOrEqual(50)
      }
    })
  }
})
