import type { DesignDocument } from "../types"
import { buildSlimDocumentContextForAgent } from "./design-prompt"
import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "./design-agent-schemas"
import { retrieveDesignPatterns } from "./design-pattern-retrieval"

const JSON_ONLY = "Reply with ONLY one JSON object (no markdown fences, no prose). The API uses JSON mode."

export function buildIntentPlanSystemPrompt(userMessage: string): string {
  const patterns = retrieveDesignPatterns(userMessage, 3200)
  return [
    "You are stage 1–2 of a design agent: semantic intent + layout plan. Do NOT output canvas elements or coordinates.",
    JSON_ONLY,
    "",
    "Return exactly this shape:",
    `{ "intent": { "designType": string, "tone": string, "platform": string, "density": "minimal"|"normal"|"dense", "contentPriority": string[], "audience": string },`,
    `  "plan": { "layoutType": string, "visualHierarchy": string[], "grid": { "columns": number, "safeMargin": number }, "spacingStrategy": { "baseUnit": number, "sectionGap": number } } }`,
    "",
    "Internal design knowledge (follow unless user conflicts):",
    patterns,
  ].join("\n")
}

export function buildDesignSystemPhasePrompt(userMessage: string, ip: IntentPlanPayload): string {
  const patterns = retrieveDesignPatterns(`${userMessage} ${ip.plan.layoutType}`, 2400)
  return [
    "You are stage 3: design tokens only. Do NOT output canvas elements.",
    JSON_ONLY,
    "",
    "Return:",
    `{ "designSystem": { "tokens": { "colors": { "background": "#...", "surface": "#...", "textPrimary": "#...", "accent": "#..." }, "radius": number, "spacingScale": number[], "fontScale": number[], "headingFont": string, "bodyFont": string } } }`,
    "",
    "Intent + plan:",
    JSON.stringify(ip),
    "",
    "Knowledge:",
    patterns,
  ].join("\n")
}

export function buildLayoutTreePhasePrompt(userMessage: string, ip: IntentPlanPayload, tokens: DesignTokenBundle): string {
  return [
    "You are stage 4: semantic layout regions only. relativeRect uses 0–1 fractions of the page (x,y,w,h).",
    JSON_ONLY,
    "",
    "Return:",
    `{ "layout": { "regions": [ { "id": string, "role": string, "relativeRect": { "x": number, "y": number, "w": number, "h": number } } ] } }`,
    "",
    "Intent + plan:",
    JSON.stringify(ip),
    "",
    "Design tokens:",
    JSON.stringify(tokens),
    "",
    "User message:",
    userMessage,
  ].join("\n")
}

const COMPOSE_RULES = `Canvas JSON rules (critical):
- Output exactly ONE JSON object: either {"kind":"document","document":DesignDocument,"assistantNote":string} OR {"kind":"patches","patches":[PatchOp,...],"assistantNote":string} OR {"kind":"message","text":string}.
- If CURRENT DOCUMENT is missing or has zero elements, you MUST return {"kind":"document",...} with a full DesignDocument including at least one text or shape on page 0. Do NOT return {"kind":"patches"} when there is no document to patch — the client cannot apply patches without a base document.
- When a non-empty document already exists, prefer "patches" for edits; every create_element must use a pageId that exists in the current document JSON.
- page.backgroundColor solid hex; elements fully inside page width/height; x,y,width,height multiples of 8; min margin 64px from edges.
- Max 6 elements per page; zIndex starts at 1.
- Every element MUST include: id (unique string), kind, x, y, width, height, rotation (0), zIndex, opacity (1).
- text element REQUIRED fields: kind:"text", content (the actual visible text string — NEVER omit or leave empty), fontFamily, fontSize, fontWeight, fontStyle ("normal"|"italic"), color (hex), textAlign ("left"|"center"|"right"), lineHeight.
- shape element REQUIRED fields: kind:"shape", shape ("rectangle"|"ellipse"|"triangle"|"line"|"arrow"), fill (hex).
- image element REQUIRED fields: kind:"image", src (URL string), objectFit ("cover"|"contain"|"fill").
- icon element REQUIRED fields: kind:"icon", iconName (string), color (hex).
- assistantNote: concise summary + follow-ups, max ~800 chars plain text.
- EXAMPLE text element: {"id":"el1","kind":"text","content":"Your headline here","x":64,"y":64,"width":952,"height":80,"rotation":0,"zIndex":1,"opacity":1,"fontFamily":"Inter","fontSize":48,"fontWeight":"700","fontStyle":"normal","color":"#1A1A1A","textAlign":"center","lineHeight":1.2}`

export function buildComposePhaseSystemPrompt(document: DesignDocument | null, bundle: {
  intentPlan: IntentPlanPayload
  tokens: DesignTokenBundle
  layout: LayoutTree
}): string {
  const slim = buildSlimDocumentContextForAgent(document, 10_000)
  return [
    JSON_ONLY,
    "You are stage 5: produce the final canvas as patches or a full document. Obey the semantic plan and tokens.",
    COMPOSE_RULES,
    "",
    document
      ? "You are editing an existing document: prefer kind:\"patches\" unless a full redesign is clearly required."
      : "There is no document yet: you MUST emit kind:\"document\" with a complete DesignDocument (pages, theme, elements).",
    "",
    "Semantic bundle:",
    JSON.stringify(bundle),
    "",
    "CURRENT DOCUMENT (trimmed):",
    slim,
  ].join("\n")
}

/**
 * Minimal fallback compose prompt used only when the full compose step fails to produce
 * parseable JSON. Strips the document snapshot and most bundle details to reduce context size,
 * maximising the chance that a small model returns clean JSON on a second attempt.
 */
export function buildComposeFallbackPrompt(
  document: DesignDocument | null,
  intentPlan: IntentPlanPayload,
  tokens: DesignTokenBundle,
): string {
  const colors = tokens.tokens.colors
  const intent = intentPlan.intent
  const headingFont = tokens.tokens.headingFont
  const bodyFont = tokens.tokens.bodyFont
  return [
    JSON_ONLY,
    document
      ? 'Output ONLY {"kind":"patches","patches":[...],"assistantNote":"..."} with at most 6 create_element ops using the existing pageId from the document.'
      : 'Output ONLY {"kind":"document","document":{id,title,type,createdAt,updatedAt,theme,pages},"assistantNote":"..."}.',
    "",
    "Canvas rules (non-negotiable):",
    "- page width:1080, height:1080",
    "- max 5 elements, zIndex starts at 1",
    "- all x/y/width/height must be multiples of 8",
    "- min 64px margin from every edge",
    "- text elements need: content (the visible text string), fontFamily, fontSize, fontWeight, fontStyle (\"normal\"|\"italic\"), color (hex), textAlign (\"left\"|\"center\"|\"right\"), lineHeight",
    "- shape elements need: shape (rectangle|ellipse), fill (hex)",
    "- document type: social-post",
    "",
    `Design intent: ${intent.designType}, tone: ${intent.tone}, platform: ${intent.platform}`,
    `Fonts — heading: ${headingFont}, body: ${bodyFont}`,
    `Colors: ${JSON.stringify(colors)}`,
    `User request: ${intentPlan.plan.layoutType}`,
  ].join("\n")
}

export function buildRepairPatchesSystemPrompt(
  document: DesignDocument | null,
  issues: { type: string; message: string; elementIds?: string[] }[],
): string {
  const slim = buildSlimDocumentContextForAgent(document, 16_000)
  return [
    "You fix validation issues by emitting ONLY { \"kind\":\"patches\", \"patches\": [...] } — minimal PatchOps.",
    JSON_ONLY,
    "",
    "Issues:",
    JSON.stringify(issues),
    "",
    "Current document:",
    slim,
    "",
    "Allowed patch ops: update_element, delete_element, create_element, update_page, apply_theme, reorder_element.",
  ].join("\n")
}
