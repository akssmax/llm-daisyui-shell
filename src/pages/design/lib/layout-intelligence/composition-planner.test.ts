import { describe, expect, it } from "vitest"
import {
  getLayoutById,
  getTokenPresetById,
  layoutPatternToLayoutTree,
  tokenPresetToBundle,
} from "./layout-catalog"
import { planComposition } from "./composition-planner"
import type { RegionContent } from "../design-compose-assembler"

describe("planComposition", () => {
  it("plans regions for li-carousel-hero-centered", () => {
    const pattern = getLayoutById("li-carousel-hero-centered")
    expect(pattern).toBeDefined()
    const layout = layoutPatternToLayoutTree(pattern!)
    const preset = getTokenPresetById("modern-saas")!
    const tokens = tokenPresetToBundle(preset) as import("../design-agent-schemas").DesignTokenBundle

    const contents: RegionContent[] = [
      { regionId: "headline", content: "Ship faster with AI" },
      { regionId: "stat", content: "3×" },
      { regionId: "body", content: "Teams save hours every week." },
      { regionId: "cta", content: "Get started" },
    ]

    const plan = planComposition({
      layout,
      contents,
      intentPlan: {
        intent: {
          designType: "linkedin-carousel",
          tone: "modern",
          platform: "linkedin",
          density: "minimal",
          contentPriority: ["headline"],
          audience: "founders",
        },
        plan: {
          layoutType: "hero-centered",
          visualHierarchy: ["headline", "stat", "cta"],
          grid: { columns: 12, safeMargin: 64 },
          spacingStrategy: { baseUnit: 8, sectionGap: 48 },
        },
      },
      tokens,
      pageWidth: 1080,
      pageHeight: 1350,
      constraints: pattern!.constraints,
    })

    expect(plan.regions.length).toBeGreaterThanOrEqual(3)
    const textRegions = plan.regions.filter((r) => r.kind === "text")
    expect(textRegions[0]?.kind).toBe("text")
    if (textRegions[0]?.kind === "text") {
      expect(textRegions[0].fontSize).toBeGreaterThan(20)
    }
  })

  it("renders visual region as icon from icon kind= syntax", () => {
    const pattern = getLayoutById("li-carousel-split")
    expect(pattern).toBeDefined()
    const layout = layoutPatternToLayoutTree(pattern!)
    const preset = getTokenPresetById("modern-saas")!
    const tokens = tokenPresetToBundle(preset) as import("../design-agent-schemas").DesignTokenBundle

    const plan = planComposition({
      layout,
      contents: [
        { regionId: "headline", content: "Zapier + Figma + Airtable—Inside Chrome" },
        { regionId: "body", content: "What if Chrome could replace your entire tool stack?" },
        { regionId: "visual", content: "icon kind=users" },
        { regionId: "footer", content: "Unify Your Tools Today →" },
      ],
      intentPlan: {
        intent: {
          designType: "linkedin-carousel",
          tone: "modern",
          platform: "linkedin",
          density: "normal",
          contentPriority: ["headline"],
          audience: "founders",
        },
        plan: {
          layoutType: "split",
          visualHierarchy: ["headline", "visual", "body"],
          grid: { columns: 12, safeMargin: 64 },
          spacingStrategy: { baseUnit: 8, sectionGap: 48 },
        },
      },
      tokens,
      pageWidth: 1080,
      pageHeight: 1350,
      constraints: pattern!.constraints,
    })

    const icon = plan.regions.find((r) => r.kind === "icon")
    expect(icon).toBeDefined()
    if (icon?.kind === "icon") {
      expect(icon.iconName).toBe("users")
    }
    const headline = plan.regions.find((r) => r.kind === "text" && r.content.includes("Zapier"))
    expect(headline?.kind).toBe("text")
    if (headline?.kind === "text") {
      expect(headline.content).toBe("Zapier + Figma + Airtable—Inside Chrome")
    }
  })

  it("renders visual region as silhouette from silhouette kind= syntax", () => {
    const pattern = getLayoutById("li-carousel-split")
    expect(pattern).toBeDefined()
    const layout = layoutPatternToLayoutTree(pattern!)
    const preset = getTokenPresetById("modern-saas")!
    const tokens = tokenPresetToBundle(preset) as import("../design-agent-schemas").DesignTokenBundle

    const plan = planComposition({
      layout,
      contents: [
        { regionId: "headline", content: "Love your product" },
        { regionId: "visual", content: "silhouette kind=Heart" },
      ],
      intentPlan: {
        intent: {
          designType: "linkedin-carousel",
          tone: "modern",
          platform: "linkedin",
          density: "normal",
          contentPriority: ["headline"],
          audience: "founders",
        },
        plan: {
          layoutType: "split",
          visualHierarchy: ["headline", "visual"],
          grid: { columns: 12, safeMargin: 64 },
          spacingStrategy: { baseUnit: 8, sectionGap: 48 },
        },
      },
      tokens,
      pageWidth: 1080,
      pageHeight: 1350,
      constraints: pattern!.constraints,
    })

    const silhouette = plan.regions.find((r) => r.kind === "silhouette")
    expect(silhouette).toBeDefined()
    if (silhouette?.kind === "silhouette") {
      expect(silhouette.shapeName).toBe("Heart")
    }
  })
})
