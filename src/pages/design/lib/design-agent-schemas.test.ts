import { describe, expect, it } from "vitest"
import { parseIntentPlan, parseDesignSystem, parseLayoutTree } from "./design-agent-schemas"

describe("parseIntentPlan", () => {
  it("accepts valid intent+plan", () => {
    const obj = {
      intent: {
        designType: "slide",
        tone: "professional",
        platform: "linkedin",
        density: "minimal",
        contentPriority: ["hero"],
        audience: "execs",
      },
      plan: {
        layoutType: "centered-hero",
        visualHierarchy: ["stat", "title"],
        grid: { columns: 12, safeMargin: 64 },
        spacingStrategy: { baseUnit: 8, sectionGap: 32 },
      },
    }
    const r = parseIntentPlan(obj)
    expect(r).not.toBeNull()
    expect(r?.intent.designType).toBe("slide")
    expect(r?.plan.grid.safeMargin).toBe(64)
  })
})

describe("parseDesignSystem", () => {
  it("requires tokens", () => {
    const ok = parseDesignSystem({
      designSystem: {
        tokens: {
          colors: { background: "#0F172A", textPrimary: "#F8FAFC", accent: "#6366F1" },
          radius: 16,
          spacingScale: [8, 16, 24],
          fontScale: [16, 24, 48],
          headingFont: "Inter",
          bodyFont: "Inter",
        },
      },
    })
    expect(ok).not.toBeNull()
    expect(ok?.tokens.radius).toBe(16)
  })
})

describe("parseLayoutTree", () => {
  it("parses regions", () => {
    const r = parseLayoutTree({
      layout: {
        regions: [
          { id: "r1", role: "hero", relativeRect: { x: 0.1, y: 0.1, w: 0.8, h: 0.3 } },
        ],
      },
    })
    expect(r?.regions[0]?.id).toBe("r1")
  })
})
