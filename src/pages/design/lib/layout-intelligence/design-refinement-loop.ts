import type { DesignDocument } from "../../types"
import type { RegionContent } from "../design-compose-assembler"
import { assembleDocumentFromRegionContents } from "../design-compose-assembler"
import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "../design-agent-schemas"
import { runFullQualityPipeline, type QualityPipelineOptions } from "./design-auto-fix"
import { critiqueDesign, passesCriticGate, CRITIC_PASS_THRESHOLD } from "./design-critic"
import type { DesignCritique } from "./types"
import { validateContentAgainstConstraints, type ContentViolation } from "./constraint-validator"

export type RefinementResult = {
  document: DesignDocument
  critique: DesignCritique
  violations: ContentViolation[]
  rounds: number
}

export type AssembleAndRefineInput = {
  layout: LayoutTree
  regionContents: RegionContent[]
  intentPlan: IntentPlanPayload
  tokens: DesignTokenBundle
  pageWidth: number
  pageHeight: number
  pipelineOpts: QualityPipelineOptions
  documentType?: import("../../types").DocumentType
}

export type AssembleRefinementOptions = AssembleAndRefineInput & {
  /** Only shorten copy when LLM refinement explicitly requests it. */
  allowTruncate?: boolean
}

export function assembleWithRefinement(input: AssembleRefinementOptions): RefinementResult {
  const { layout, intentPlan, tokens, pageWidth, pageHeight, pipelineOpts } = input
  const contents = input.regionContents
  const violations = validateContentAgainstConstraints(contents, layout.constraints)

  let doc = assembleDocumentFromRegionContents(layout, contents, {
    intentPlan,
    tokens,
    pageWidth,
    pageHeight,
    tokenPresetId: pipelineOpts.tokenPresetId,
    title: intentPlan.intent.designType,
  })
  if (input.documentType) {
    doc = { ...doc, type: input.documentType }
  }

  let rounds = 0
  let critique = critiqueDesign(doc, pipelineOpts)

  for (let i = 0; i < 2 && !passesCriticGate(critique); i++) {
    rounds++
    const refined = runFullQualityPipeline(doc, pipelineOpts)
    doc = refined.document
    critique = refined.critique
  }

  return { document: doc, critique, violations, rounds }
}

export function formatViolationsForPrompt(violations: ContentViolation[], max = 5): string {
  return violations
    .slice(0, max)
    .map((v) => `- [${v.regionId}] ${v.message}`)
    .join("\n")
}

export function formatCritiqueIssuesForPrompt(critique: DesignCritique, max = 5): string {
  return critique.issues
    .slice(0, max)
    .map((i) => `- [${i.type}/${i.severity}] ${i.message}`)
    .join("\n")
}

export { CRITIC_PASS_THRESHOLD, passesCriticGate }
