import { describe, expect, it } from "vitest"
import { getAllLayouts, getLayoutById } from "./layout-catalog"
import { retrieveLayouts, buildRetrievalQueryFromIntent } from "./layout-retrieval"
import { critiqueDesign } from "./design-critic"
import { parseIntentPlan } from "../design-agent-schemas"
import type { DesignDocument } from "../../types"
import { assembleDocumentFromRegionContents } from "../design-compose-assembler"
import { getTokenPresetById, layoutPatternToLayoutTree, tokenPresetToBundle } from "./layout-catalog"

describe("layout catalog", () => {
  it("loads at least 35 layouts", () => {
    expect(getAllLayouts().length).toBeGreaterThanOrEqual(35)
  })

  it("finds layout by id", () => {
    const l = getLayoutById("li-carousel-hero-centered")
    expect(l?.category).toBe("linkedin-carousel")
    expect(l?.regions.length).toBeGreaterThan(0)
  })
})

describe("layout retrieval", () => {
  it("ranks linkedin carousel for linkedin prompt", () => {
    const intent = parseIntentPlan({
      intent: {
        designType: "carousel",
        tone: "modern startup",
        platform: "linkedin",
        density: "normal",
        contentPriority: ["metric"],
        audience: "founders",
      },
      plan: {
        layoutType: "hero-centered",
        visualHierarchy: ["headline", "stat"],
        grid: { columns: 12, safeMargin: 64 },
        spacingStrategy: { baseUnit: 8, sectionGap: 48 },
      },
    })
    expect(intent).not.toBeNull()
    const q = buildRetrievalQueryFromIntent("LinkedIn carousel for startup KPI", intent!)
    const { top3 } = retrieveLayouts(q, intent!)
    expect(top3.length).toBeGreaterThan(0)
    expect(top3[0]?.category).toBe("linkedin-carousel")
  })
})

describe("design critic", () => {
  it("scores weak hierarchy lower", () => {
    const doc: DesignDocument = {
      id: "d1",
      title: "Test",
      type: "social-post",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: {
        primaryColor: "#000",
        secondaryColor: "#666",
        accentColor: "#00f",
        backgroundColor: "#fff",
        fontFamily: "Inter",
      },
      pages: [
        {
          id: "p1",
          width: 1080,
          height: 1080,
          backgroundColor: "#FFFFFF",
          elements: [
            {
              id: "t1",
              kind: "text",
              content: "Subheading too close in size",
              fontFamily: "Inter",
              fontSize: 40,
              fontWeight: "600",
              fontStyle: "normal",
              color: "#111",
              textAlign: "left",
              lineHeight: 1.2,
              x: 80,
              y: 80,
              width: 400,
              height: 40,
              rotation: 0,
              zIndex: 1,
              opacity: 1,
            },
            {
              id: "t2",
              kind: "text",
              content: "Headline barely larger",
              fontFamily: "Inter",
              fontSize: 48,
              fontWeight: "700",
              fontStyle: "normal",
              color: "#111",
              textAlign: "left",
              lineHeight: 1.15,
              x: 80,
              y: 200,
              width: 800,
              height: 120,
              rotation: 0,
              zIndex: 2,
              opacity: 1,
            },
          ],
        },
      ],
    }
    const critique = critiqueDesign(doc)
    expect(critique.hierarchyScore).toBeLessThan(80)
    expect(critique.issues.some((i) => i.type === "hierarchy")).toBe(true)
  })
})

describe("assembler from catalog layout", () => {
  it("maps regions to elements inside page bounds", () => {
    const pattern = getLayoutById("social-hero-bold")
    expect(pattern).toBeDefined()
    const intent = parseIntentPlan({
      intent: {
        designType: "social post",
        tone: "bold",
        platform: "instagram",
        density: "minimal",
        contentPriority: ["headline"],
        audience: "general",
      },
      plan: {
        layoutType: "bold-typography-poster",
        visualHierarchy: ["headline"],
        grid: { columns: 12, safeMargin: 64 },
        spacingStrategy: { baseUnit: 8, sectionGap: 48 },
      },
    })!
    const tokens = tokenPresetToBundle(getTokenPresetById("modern-saas")!)
    const layout = layoutPatternToLayoutTree(pattern!)
    const doc = assembleDocumentFromRegionContents(
      layout,
      [{ regionId: "headline", content: "Hello World" }],
      { intentPlan: intent, tokens: tokens as never },
    )
    expect(doc.pages[0]?.elements.length).toBeGreaterThan(0)
    const critique = critiqueDesign(doc)
    expect(critique.compositeScore).toBeGreaterThan(0)
  })
})
