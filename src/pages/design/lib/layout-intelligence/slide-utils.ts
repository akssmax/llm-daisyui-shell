import type { IntentPlanPayload } from "../design-agent-schemas"
import type { DocumentType } from "../../types"
import { PRESET_SIZES } from "../design-presets"

const MAX_SLIDES = 12

function parseSlideNumber(blob: string, pattern: RegExp): number | null {
  const m = blob.match(pattern)
  if (!m?.[1]) return null
  const n = Number.parseInt(m[1], 10)
  return n >= 1 ? Math.min(n, MAX_SLIDES) : null
}

/** Slides to append to an existing deck (e.g. "create 4 more slides"). */
export function inferSlidesToAdd(userMessage: string): number {
  const blob = userMessage.toLowerCase()
  return (
    parseSlideNumber(blob, /(?:create|add|make)\s+(\d+)\s+more\s+(?:slides?|pages?|cards?)/i) ??
    parseSlideNumber(blob, /(\d+)\s+more\s+(?:slides?|pages?|cards?)/i) ??
    parseSlideNumber(blob, /(?:create|add)\s+(\d+)\s+additional\s+(?:slides?|pages?)/i) ??
    parseSlideNumber(blob, /(?:create|add)\s+(\d+)\s+(?:new\s+)?(?:slides?|pages?)/i) ??
    0
  )
}

/** Quick slide count from user text only (routing before intent plan). */
export function inferSlideCountFromMessage(userMessage: string): number {
  const blob = userMessage.toLowerCase()
  const toAdd = inferSlidesToAdd(userMessage)
  if (toAdd > 0) return toAdd

  const explicit =
    parseSlideNumber(blob, /(\d+)\s*[- ]?\s*slide/i) ??
    parseSlideNumber(blob, /(\d+)\s*(?:slides?|cards?|pages?|frames?|posts?)/i)
  if (explicit) return explicit

  if (blob.includes("carousel")) return 5
  if (blob.includes("deck") || blob.includes("presentation")) {
    const deckMatch = parseSlideNumber(blob, /(\d+)\s*(?:slide|page)/i)
    return deckMatch ?? 5
  }

  return 1
}

/** Parse requested slide/page count from user message and intent. */
export function inferSlideCount(userMessage: string, intent: IntentPlanPayload): number {
  const fromPlan = (intent.plan as { slideCount?: number }).slideCount
  if (typeof fromPlan === "number" && fromPlan >= 1) {
    return Math.min(Math.round(fromPlan), MAX_SLIDES)
  }

  return inferSlideCountFromMessage(userMessage)
}

export function inferDocumentType(userMessage: string, intent: IntentPlanPayload): DocumentType {
  const blob = `${userMessage} ${intent.intent.designType} ${intent.intent.platform}`.toLowerCase()
  if (blob.includes("carousel")) return "carousel"
  if (blob.includes("presentation") || blob.includes("slide deck") || blob.includes("pitch")) {
    return "slide"
  }
  if (blob.includes("linkedin") && blob.includes("carousel")) return "carousel"
  if (blob.includes("instagram") || blob.includes("social")) return "social-post"
  return inferSlideCount(userMessage, intent) > 1 ? "carousel" : "social-post"
}

export function pageDimensionsForIntent(
  userMessage: string,
  intent: IntentPlanPayload,
): { width: number; height: number } {
  const blob = `${userMessage} ${intent.intent.platform} ${intent.intent.designType}`.toLowerCase()
  if (blob.includes("presentation") || blob.includes("1920")) {
    return { width: PRESET_SIZES.presentation.width, height: PRESET_SIZES.presentation.height }
  }
  if (blob.includes("linkedin") || blob.includes("carousel") || blob.includes("1350")) {
    return { width: PRESET_SIZES["linkedin-carousel"].width, height: PRESET_SIZES["linkedin-carousel"].height }
  }
  if (blob.includes("instagram") && !blob.includes("story")) {
    return { width: PRESET_SIZES["instagram-post"].width, height: PRESET_SIZES["instagram-post"].height }
  }
  return { width: 1080, height: 1080 }
}

/** Whether the intelligence assembler path should run instead of legacy compose. */
export function shouldRunIntelligencePipeline(
  userMessage: string,
  isCanvasEmpty: boolean,
): boolean {
  if (isCanvasEmpty) return true
  if (inferSlidesToAdd(userMessage) > 0) return true
  if (inferSlideCountFromMessage(userMessage) > 1) return true
  return false
}
