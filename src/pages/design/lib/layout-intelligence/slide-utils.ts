import { nanoid } from "nanoid"
import type { IntentPlanPayload } from "../design-agent-schemas"
import type { DesignDocument, DesignPage, DocumentType } from "../../types"
import type { CanvasPresetMode } from "../design-presets"
import { resolveCanvasSpec, type CanvasSpec } from "./canvas-spec"

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

/**
 * 0-based page index when the user names a specific slide/page to edit
 * (e.g. "in slide 6", "on page 3", "edit slide 2").
 * Does not match "6-slide carousel" (digit before "slide").
 */
export function inferTargetSlideIndex(
  userMessage: string,
  pageCount?: number,
): number | null {
  const blob = userMessage.toLowerCase()
  const oneBased =
    parseSlideNumber(blob, /(?:on|in|for|at)\s+(?:the\s+)?(?:slide|page|card|frame)\s*#?\s*(\d+)/i) ??
    parseSlideNumber(
      blob,
      /(?:edit|update|change|replace|redesign|modify|create)\s+(?:on\s+)?(?:the\s+)?(?:slide|page)\s*#?\s*(\d+)/i,
    ) ??
    parseSlideNumber(blob, /\b(?:slide|page|card|frame)\s*#?\s*(\d+)\b/i)

  if (!oneBased) return null
  const idx = oneBased - 1
  if (idx < 0 || idx >= MAX_SLIDES) return null
  void pageCount
  return idx
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
  const canvas = resolveCanvasForTurn(userMessage, intent, "auto")
  if (canvas.documentType) return canvas.documentType

  const blob = `${userMessage} ${intent.intent.designType} ${intent.intent.platform}`.toLowerCase()
  if (blob.includes("carousel")) return "carousel"
  if (blob.includes("presentation") || blob.includes("slide deck") || blob.includes("pitch")) {
    return "slide"
  }
  if (blob.includes("linkedin") && blob.includes("carousel")) return "carousel"
  if (blob.includes("instagram") || blob.includes("social")) return "social-post"
  return inferSlideCount(userMessage, intent) > 1 ? "carousel" : "social-post"
}

export function resolveCanvasForTurn(
  userMessage: string,
  intent: IntentPlanPayload,
  presetKey?: CanvasPresetMode | null,
): CanvasSpec {
  return resolveCanvasSpec({
    userMessage,
    intent,
    presetKey: presetKey ?? "auto",
  })
}

export function pageDimensionsForIntent(
  userMessage: string,
  intent: IntentPlanPayload,
  presetKey?: CanvasPresetMode | null,
): { width: number; height: number } {
  const spec = resolveCanvasForTurn(userMessage, intent, presetKey)
  return { width: spec.width, height: spec.height }
}

/** Whether the intelligence assembler path should run instead of legacy compose. */
export function shouldRunIntelligencePipeline(
  userMessage: string,
  isCanvasEmpty: boolean,
  pageCount = 0,
): boolean {
  if (isCanvasEmpty) return true
  if (inferSlidesToAdd(userMessage) > 0) return true
  if (inferSlideCountFromMessage(userMessage) > 1) return true
  if (pageCount > 0 && inferTargetSlideIndex(userMessage, pageCount) !== null) return true
  return false
}

/** Replace or append a single generated page at targetIndex; preserves other pages and page ids. */
export function mergeEditedPageIntoDocument(
  existing: DesignDocument,
  targetIndex: number,
  generatedPage: DesignPage,
): DesignDocument {
  const pages: DesignPage[] = [...existing.pages]
  const ref = pages[pages.length - 1] ?? generatedPage

  const blankPage = (): DesignPage => ({
    id: nanoid(8),
    width: ref.width,
    height: ref.height,
    backgroundColor: ref.backgroundColor ?? "#ffffff",
    elements: [],
  })

  if (targetIndex < pages.length) {
    const prev = pages[targetIndex]
    pages[targetIndex] = {
      ...prev,
      elements: generatedPage.elements,
      backgroundColor: generatedPage.backgroundColor ?? prev.backgroundColor,
      width: generatedPage.width,
      height: generatedPage.height,
    }
  } else {
    while (pages.length < targetIndex) {
      pages.push(blankPage())
    }
    pages.push({
      ...generatedPage,
      id: nanoid(8),
    })
  }

  return {
    ...existing,
    pages,
    updatedAt: new Date().toISOString(),
  }
}
