import { describe, expect, it } from "vitest"
import { assembleDocumentFromRegionContents } from "../design-compose-assembler"
import { parseIntentPlan } from "../design-agent-schemas"
import { normalizeIconName } from "../lucide-icon-registry"
import { pickStylePresetForIntent } from "./style-auto-pick"
import {
  buildTailwindTokenBundle,
  isAllowedTailwindHex,
} from "./tailwind-theme-builder"
import { getLayoutById, layoutPatternToLayoutTree, tokenPresetToBundle } from "./layout-catalog"

describe("lucide icon registry", () => {
  it("normalizes kebab and camelCase names", () => {
    expect(normalizeIconName("arrow-right")).toBe("arrow-right")
    expect(normalizeIconName("arrowRight")).toBe("arrow-right")
    expect(normalizeIconName("not-a-real-icon-xyz")).toBeNull()
  })
})

describe("tailwind theme builder", () => {
  it("uses only allowlisted hex values", () => {
    const bundle = buildTailwindTokenBundle({ accentHue: "emerald", mode: "light" })
    expect(isAllowedTailwindHex(bundle.colors.background)).toBe(true)
    expect(isAllowedTailwindHex(bundle.colors.accent)).toBe(true)
    expect(isAllowedTailwindHex(bundle.colors.textPrimary)).toBe(true)
    expect(isAllowedTailwindHex("#FFFF00")).toBe(false)
  })
})

describe("style auto-pick brutalist gating", () => {
  const intent = parseIntentPlan({
    intent: {
      designType: "poster",
      tone: "bold",
      platform: "instagram",
      density: "normal",
      contentPriority: ["headline"],
      audience: "general",
    },
    plan: {
      layoutType: "hero",
      visualHierarchy: ["headline"],
      grid: { columns: 12, safeMargin: 64 },
      spacingStrategy: { baseUnit: 8, sectionGap: 48 },
    },
  })!

  it("does not pick brutalist for bold headline alone", () => {
    const preset = pickStylePresetForIntent("Bold headline for startup launch", intent)
    expect(preset?.id).not.toBe("brutalist-style")
  })

  it("picks brutalist when explicitly requested", () => {
    const preset = pickStylePresetForIntent("brutalist poster with raw typography", intent)
    expect(preset?.id).toBe("brutalist-style")
  })
})

describe("assembler icon regions", () => {
  it("emits IconElement for icon region content", () => {
    const pattern = getLayoutById("social-hero-bold")
    expect(pattern).toBeDefined()
    const intent = parseIntentPlan({
      intent: {
        designType: "social",
        tone: "modern",
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
    const tokens = tokenPresetToBundle(buildTailwindTokenBundle({ accentHue: "indigo", mode: "light" }))
    const layout = layoutPatternToLayoutTree(pattern!)
    const doc = assembleDocumentFromRegionContents(
      layout,
      [
        { regionId: "headline", content: "Hello" },
        { regionId: "accent_icon", kind: "icon", iconName: "sparkles", content: "sparkles" },
      ],
      { intentPlan: intent, tokens: tokens as never },
    )
    const icon = doc.pages[0]?.elements.find((e) => e.kind === "icon")
    expect(icon).toBeDefined()
    if (icon?.kind === "icon") {
      expect(icon.iconName).toBe("sparkles")
    }
  })
})
