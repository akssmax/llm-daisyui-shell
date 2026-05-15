import type { DesignDocument } from "../types"
import { safePageElements } from "./safe-page-elements"
import {
  inferSlidesToAdd,
  inferTargetSlideIndex,
} from "./layout-intelligence/slide-utils"

export type DesignAgentOperation = "design_create" | "design_edit" | "design_recompose_layout"

export const REMIX_LAYOUT_USER_MESSAGE =
  "Remix layout: keep every text string, icon name, and data value exactly as listed in the content manifest. Create a new visual arrangement and hierarchy on the canvas."

function documentHasElements(doc: DesignDocument | null): boolean {
  if (!doc) return false
  for (const p of doc.pages) {
    if (safePageElements(p).length > 0) return true
  }
  return false
}

function isCanvasEmpty(doc: DesignDocument | null): boolean {
  return !documentHasElements(doc)
}

function wantsRecomposeFromText(userMessage: string): boolean {
  return /\b(remix\s+layout|rearrange\s+layout|new\s+layout|different\s+layout|try\s+another\s+layout)\b/i.test(
    userMessage,
  )
}

function wantsNewDesign(userMessage: string): boolean {
  return /\b(new\s+design|start\s+over|from\s+scratch|blank\s+canvas)\b/i.test(userMessage)
}

export function routeDesignAgentOperation(opts: {
  userMessage: string
  document: DesignDocument | null
  forcedOperation?: DesignAgentOperation
}): DesignAgentOperation {
  if (opts.forcedOperation) return opts.forcedOperation

  const msg = opts.userMessage.trim()
  const doc = opts.document

  if (wantsRecomposeFromText(msg) && documentHasElements(doc)) {
    return "design_recompose_layout"
  }

  if (isCanvasEmpty(doc) || wantsNewDesign(msg)) {
    return "design_create"
  }

  if (inferSlidesToAdd(msg) > 0) {
    return "design_create"
  }

  const pageCount = doc?.pages.length ?? 0
  const targetIdx = inferTargetSlideIndex(msg, pageCount)
  if (targetIdx !== null && documentHasElements(doc)) {
    return "design_create"
  }

  if (/\b(create|design|make|build)\b/i.test(msg) && !documentHasElements(doc)) {
    return "design_create"
  }

  return "design_edit"
}

export function isStructuredDocumentRequest(userMessage: string, designType?: string): boolean {
  const blob = `${userMessage} ${designType ?? ""}`.toLowerCase()
  return /\b(invoice|receipt|bill|statement|form|table|line\s*items?|billing|quote|proposal|contract|resume|cv|cover\s*letter)\b/.test(
    blob,
  )
}
