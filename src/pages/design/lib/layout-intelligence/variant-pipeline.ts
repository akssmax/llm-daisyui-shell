import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "../design-agent-schemas"
import {
  assembleDocumentFromRegionContents,
  type RegionContent,
} from "../design-compose-assembler"
import { getTokenPresetById, layoutPatternToLayoutTree, tokenPresetToBundle } from "./layout-catalog"
import { passesCriticGate } from "./design-critic"
import { runFullQualityPipeline } from "./design-auto-fix"
import { retrieveLayouts, buildRetrievalQueryFromIntent } from "./layout-retrieval"
import type { DesignVariant, LayoutPattern } from "./types"
import { getLayoutMemorySignals } from "./design-memory-store"

export type VariantPipelineInput = {
  intentPlan: IntentPlanPayload
  tokens: DesignTokenBundle
  regionContents: RegionContent[]
  userPrompt: string
  tokenPresetId?: string
  pageWidth?: number
  pageHeight?: number
}

export async function buildVariantsFromLayouts(
  input: VariantPipelineInput,
  layoutPatterns?: LayoutPattern[],
): Promise<DesignVariant[]> {
  const memory = await getLayoutMemorySignals(input.intentPlan.intent.designType)
  const query = buildRetrievalQueryFromIntent(input.userPrompt, input.intentPlan, {
    memoryBoost: memory,
  })

  const patterns =
    layoutPatterns ??
    retrieveLayouts(query, input.intentPlan).top5.slice(0, 3)

  const variants: DesignVariant[] = []

  for (const pattern of patterns) {
    const layoutTree: LayoutTree = layoutPatternToLayoutTree(pattern)
    const doc = assembleDocumentFromRegionContents(layoutTree, input.regionContents, {
      intentPlan: input.intentPlan,
      tokens: input.tokens,
      title: input.intentPlan.intent.designType,
      pageWidth: input.pageWidth,
      pageHeight: input.pageHeight,
    })

    const { document, critique } = runFullQualityPipeline(doc, {
      safeMargin: pattern.grid.safeMargin,
      tokenPresetId: input.tokenPresetId,
    })

    variants.push({ layoutId: pattern.id, document, critique })
  }

  return variants.sort((a, b) => b.critique.compositeScore - a.critique.compositeScore)
}

export function pickBestVariant(variants: DesignVariant[]): DesignVariant | null {
  if (variants.length === 0) return null
  const passing = variants.filter((v) => passesCriticGate(v.critique))
  return passing[0] ?? variants[0] ?? null
}

export function tokensFromPresetId(presetId: string): DesignTokenBundle | null {
  const preset = getTokenPresetById(presetId)
  if (!preset) return null
  return tokenPresetToBundle(preset) as DesignTokenBundle
}
