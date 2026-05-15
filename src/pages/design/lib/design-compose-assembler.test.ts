import { describe, expect, it } from "vitest"
import {
  assembleDocumentFromElements,
  assembleDocumentFromRegionContents,
  parseElementsOnlyCompose,
  parseRegionContentsCompose,
  regionToPixelBox,
} from "./design-compose-assembler"
import type { IntentPlanPayload, LayoutTree } from "./design-agent-schemas"

const intentPlan: IntentPlanPayload = {
  intent: {
    designType: "social-post",
    tone: "professional",
    platform: "linkedin",
    density: "normal",
    contentPriority: ["headline"],
    audience: "professionals",
  },
  plan: {
    layoutType: "hero",
    visualHierarchy: ["headline", "body"],
    grid: { columns: 1, safeMargin: 64 },
    spacingStrategy: { baseUnit: 8, sectionGap: 48 },
  },
}

const tokens = {
  tokens: {
    colors: { background: "#FFFFFF", surface: "#F1F5F9", textPrimary: "#0F172A", accent: "#6366F1" },
    radius: 8,
    spacingScale: [8, 16],
    fontScale: [14, 24, 48],
    headingFont: "Inter",
    bodyFont: "Inter",
  },
}

describe("assembleDocumentFromElements", () => {
  it("builds a document with coerced elements", () => {
    const raw = JSON.stringify({
      kind: "elements",
      elements: [
        {
          kind: "text",
          content: "Hello",
          x: 64,
          y: 64,
          width: 400,
          height: 80,
          fontSize: 32,
          fontFamily: "Inter",
          fontWeight: "700",
          color: "#000",
          textAlign: "left",
          lineHeight: 1.2,
        },
      ],
    })
    const els = parseElementsOnlyCompose(raw)
    expect(els).toHaveLength(1)
    const doc = assembleDocumentFromElements(els!, { intentPlan, tokens })
    expect(doc.pages[0]?.elements).toHaveLength(1)
    expect(doc.pages[0]?.elements[0]?.kind).toBe("text")
  })
})

describe("assembleDocumentFromRegionContents", () => {
  it("maps regions to text elements inside page bounds", () => {
    const layout: LayoutTree = {
      regions: [
        { id: "r1", role: "headline", relativeRect: { x: 0.1, y: 0.1, w: 0.8, h: 0.2 } },
      ],
    }
    const doc = assembleDocumentFromRegionContents(
      layout,
      [{ regionId: "r1", content: "Big headline" }],
      { intentPlan, tokens },
    )
    expect(doc.pages[0]?.elements.length).toBeGreaterThan(0)
    const el = doc.pages[0]!.elements[0]!
    expect(el.x + el.width).toBeLessThanOrEqual(1080)
  })
})

describe("regionToPixelBox", () => {
  it("snaps to 8px grid", () => {
    const box = regionToPixelBox(
      { id: "r", role: "body", relativeRect: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 } },
      1080,
      1080,
      64,
    )
    expect(box.x % 8).toBe(0)
    expect(box.width % 8).toBe(0)
  })
})

describe("parseRegionContentsCompose", () => {
  it("parses regionContents array", () => {
    const raw = JSON.stringify({
      kind: "region_contents",
      regionContents: [{ regionId: "r1", content: "Title" }],
    })
    const rc = parseRegionContentsCompose(raw)
    expect(rc).toHaveLength(1)
    expect(rc![0]!.content).toBe("Title")
  })
})
