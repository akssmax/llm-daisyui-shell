import type { DesignDocument, DesignElement } from "../../types"
import type { LayoutTree } from "../design-agent-schemas"
import {
  assembleDocumentFromRegionContents,
  type RegionContent,
} from "../design-compose-assembler"
import type { IntentPlanPayload, DesignTokenBundle } from "../design-agent-schemas"
import { tokenPresetToBundle } from "./layout-catalog"
import { getTokenPresetById } from "./layout-catalog"

function textElementsByReadingOrder(elements: DesignElement[]): Array<Extract<DesignElement, { kind: "text" }>> {
  return elements
    .filter((e): e is Extract<DesignElement, { kind: "text" }> => e.kind === "text")
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Map existing page text into layout regions (by order + font size). */
export function pageElementsToRegionContents(
  elements: DesignElement[],
  layout: LayoutTree,
): RegionContent[] {
  const texts = textElementsByReadingOrder(elements)
  const regions = [...layout.regions].sort((a, b) => {
    const areaA = a.relativeRect.w * a.relativeRect.h
    const areaB = b.relativeRect.w * b.relativeRect.h
    return areaB - areaA
  })

  return regions.map((region, i) => {
    const text = texts[i]
    return {
      regionId: region.id,
      content: text?.content?.trim() || region.role,
      ...(text?.fontSize ? { fontSize: text.fontSize } : {}),
      ...(text?.fontWeight ? { fontWeight: text.fontWeight } : {}),
      ...(text?.textAlign ? { textAlign: text.textAlign } : {}),
    }
  })
}

/** Re-apply a catalog layout to an existing document (all pages). */
export function applyLayoutToDocument(
  document: DesignDocument,
  layout: LayoutTree,
  tokenPresetId?: string,
): DesignDocument | null {
  const preset = tokenPresetId ? getTokenPresetById(tokenPresetId) : null
  const tokens = preset
    ? (tokenPresetToBundle(preset) as DesignTokenBundle)
    : ({
        tokens: {
          colors: {
            background: document.theme.backgroundColor,
            surface: document.theme.secondaryColor,
            textPrimary: document.theme.primaryColor,
            accent: document.theme.accentColor,
          },
          radius: 8,
          spacingScale: [8, 16, 24, 32, 48, 64],
          fontScale: [16, 20, 32, 48, 56, 72],
          headingFont: document.theme.fontFamily,
          bodyFont: document.theme.fontFamily,
        },
      } as DesignTokenBundle)

  const intentPlan: IntentPlanPayload = {
    intent: {
      designType: document.title,
      tone: "neutral",
      platform: document.type,
      density: "normal",
      contentPriority: ["content"],
      audience: "general",
    },
    plan: {
      layoutType: "catalog",
      visualHierarchy: ["headline", "body"],
      grid: { columns: 12, safeMargin: 64 },
      spacingStrategy: { baseUnit: 8, sectionGap: 48 },
    },
  }

  const pages = document.pages.map((page) => {
    const regionContents = pageElementsToRegionContents(page.elements ?? [], layout)
    const sub = assembleDocumentFromRegionContents(layout, regionContents, {
      intentPlan,
      tokens,
      pageWidth: page.width,
      pageHeight: page.height,
      pageId: page.id,
    })
    const built = sub.pages[0]
    if (!built) return page
    return { ...built, id: page.id, backgroundColor: page.backgroundColor }
  })

  return {
    ...document,
    pages,
    updatedAt: new Date().toISOString(),
  }
}
