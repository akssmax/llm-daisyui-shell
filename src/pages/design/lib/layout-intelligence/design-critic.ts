import type { DesignDocument } from "../../types"
import { validateDesignDocument } from "../design-validate"
import { collectCompositionIssues, scoreFromIssues } from "./composition-rules"
import type { DesignCritique, DesignTokensPreset } from "./types"
import { getTokenPresetById } from "./layout-catalog"
import { isAllowedTailwindHex } from "./tailwind-theme-builder"

export const CRITIC_PASS_THRESHOLD = 70
export const CRITIC_AUTO_FIX_MAX = 3

export function critiqueDesign(
  doc: DesignDocument,
  opts?: {
    safeMargin?: number
    tokenPresetId?: string
    tokenPreset?: DesignTokensPreset
    enforceTailwindOnly?: boolean
  },
): DesignCritique {
  if (doc.pages.length === 0) {
    return {
      hierarchyScore: 0,
      spacingScore: 0,
      contrastScore: 0,
      alignmentScore: 0,
      readabilityScore: 0,
      balanceScore: 0,
      compositeScore: 0,
      issues: [{ type: "balance", severity: "high", message: "No pages in document" }],
    }
  }

  const tokens =
    opts?.tokenPreset ?? (opts?.tokenPresetId ? getTokenPresetById(opts.tokenPresetId) : undefined)
  const validation = validateDesignDocument(doc, { safeMargin: opts?.safeMargin ?? 64 })

  const pageCritiques = doc.pages.map((page) => {
    const compositionIssues = collectCompositionIssues(page, tokens)
    const tailwindIssues =
      opts?.enforceTailwindOnly && page.elements
        ? page.elements.flatMap((el) => {
            const color =
              el.kind === "text" ? el.color : el.kind === "icon" ? el.color : el.kind === "shape" ? el.fill : null
            if (!color || isAllowedTailwindHex(color)) return []
            return [
              {
                type: "contrast" as const,
                severity: "medium" as const,
                message: `Color ${color} is not in the Tailwind palette`,
                elementIds: [el.id],
              },
            ]
          })
        : []
    return [...compositionIssues, ...tailwindIssues]
  })

  const validationIssues = validation.issues.map((vi) => ({
    type: mapValidationType(vi.type),
    severity: vi.type === "bounds" ? ("high" as const) : vi.type === "overlap" ? ("high" as const) : ("medium" as const),
    message: vi.message,
    elementIds: vi.elementIds,
  }))

  const issues = [...pageCritiques.flat(), ...validationIssues]

  const hierarchyScore = scoreFromIssues(issues, "hierarchy")
  const spacingScore = scoreFromIssues(issues, "spacing")
  const contrastScore = scoreFromIssues(issues, "contrast")
  const alignmentScore = scoreFromIssues(issues, "alignment")
  const readabilityScore = scoreFromIssues(issues, "readability")
  const balanceScore = scoreFromIssues(issues, "balance")

  const compositeScore = Math.round(
    hierarchyScore * 0.22 +
      spacingScore * 0.18 +
      contrastScore * 0.18 +
      alignmentScore * 0.12 +
      readabilityScore * 0.15 +
      balanceScore * 0.15,
  )

  return {
    hierarchyScore,
    spacingScore,
    contrastScore,
    alignmentScore,
    readabilityScore,
    balanceScore,
    compositeScore,
    issues,
  }
}

function mapValidationType(
  t: string,
): "hierarchy" | "spacing" | "contrast" | "alignment" | "readability" | "balance" | "overcrowding" {
  switch (t) {
    case "contrast":
      return "contrast"
    case "margin":
    case "grid":
      return "spacing"
    case "overlap":
    case "element_limit":
      return "overcrowding"
    case "text_size":
      return "hierarchy"
    case "bounds":
      return "alignment"
    default:
      return "balance"
  }
}

export function passesCriticGate(critique: DesignCritique): boolean {
  return critique.compositeScore >= CRITIC_PASS_THRESHOLD
}
