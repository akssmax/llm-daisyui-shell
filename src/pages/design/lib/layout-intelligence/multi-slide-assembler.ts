import { nanoid } from "nanoid"
import type { DesignDocument, DesignPage, DocumentType } from "../../types"
import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "../design-agent-schemas"
import {
  assembleDocumentFromRegionContents,
  type RegionContent,
} from "../design-compose-assembler"
import { runFullQualityPipeline } from "./design-auto-fix"
import { pageDimensionsForIntent } from "./slide-utils"
import type { DesignTokensPreset } from "./types"

export type SlideContentMap = {
  slides: RegionContent[][]
  slideCount: number
}

/** Build one page's elements from layout + region copy. */
function buildPageFromRegions(
  layout: LayoutTree,
  contents: RegionContent[],
  opts: {
    intentPlan: IntentPlanPayload
    tokens: DesignTokenBundle
    pageWidth: number
    pageHeight: number
    pageId: string
  },
): DesignPage {
  const doc = assembleDocumentFromRegionContents(layout, contents, {
    intentPlan: opts.intentPlan,
    tokens: opts.tokens,
    pageWidth: opts.pageWidth,
    pageHeight: opts.pageHeight,
    pageId: opts.pageId,
  })
  return doc.pages[0]!
}

/** Assemble carousel / multi-slide deck — one page per slide, same layout template. */
export function assembleMultiSlideDocument(
  layout: LayoutTree,
  slideMaps: SlideContentMap,
  opts: {
    intentPlan: IntentPlanPayload
    tokens: DesignTokenBundle
    userMessage: string
    documentType: DocumentType
    title?: string
    tokenPresetId?: string
    tokenPreset?: DesignTokensPreset
    enforceTailwindOnly?: boolean
  },
): DesignDocument {
  const dims = pageDimensionsForIntent(opts.userMessage, opts.intentPlan)
  const bg = opts.tokens.tokens.colors.background ?? "#FFFFFF"
  const now = new Date().toISOString()
  const count = Math.max(1, Math.min(slideMaps.slideCount, slideMaps.slides.length))

  const pages: DesignPage[] = []
  for (let i = 0; i < count; i++) {
    const contents = slideMaps.slides[i] ?? slideMaps.slides[slideMaps.slides.length - 1] ?? []
    pages.push(
      buildPageFromRegions(layout, contents, {
        intentPlan: opts.intentPlan,
        tokens: opts.tokens,
        pageWidth: dims.width,
        pageHeight: dims.height,
        pageId: `pg${nanoid(6)}`,
      }),
    )
  }

  let doc: DesignDocument = {
    id: `doc${nanoid(6)}`,
    title: opts.title ?? opts.intentPlan.intent.designType ?? "Design",
    type: opts.documentType,
    createdAt: now,
    updatedAt: now,
    theme: assembleDocumentFromRegionContents(layout, [], {
      intentPlan: opts.intentPlan,
      tokens: opts.tokens,
      pageWidth: dims.width,
      pageHeight: dims.height,
    }).theme,
    pages: pages.map((p) => ({ ...p, backgroundColor: bg })),
  }

  const { document } = runFullQualityPipeline(doc, {
    safeMargin: opts.intentPlan.plan.grid.safeMargin,
    tokenPresetId: opts.tokenPresetId,
    tokenPreset: opts.tokenPreset,
    enforceTailwindOnly: opts.enforceTailwindOnly,
  })
  return document
}
