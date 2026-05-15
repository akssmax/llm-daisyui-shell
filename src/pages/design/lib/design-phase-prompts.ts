import type { DesignDocument } from "../types"
import { buildDesignSystemPrompt, buildSlimDocumentContextForAgent, COMPOSE_SCHEMA_EXCERPT } from "./design-prompt"
import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "./design-agent-schemas"
import { retrieveDesignPatterns } from "./design-pattern-retrieval"

const JSON_ONLY = "Reply with ONLY one JSON object (no markdown fences, no prose). The API uses JSON mode."

const SEMANTIC_BUNDLE_MAX_CHARS = 3_500

const COMPOSE_RULES = `Canvas JSON rules (critical):
- Output exactly ONE JSON object: either {"kind":"document","document":DesignDocument,"assistantNote":string} OR {"kind":"patches","patches":[PatchOp,...],"assistantNote":string} OR {"kind":"message","text":string}.
- If CURRENT DOCUMENT is missing or has zero elements, you MUST return {"kind":"document",...} with a full DesignDocument including at least one text or shape on page 0. Do NOT return {"kind":"patches"} when there is no document to patch.
- When a non-empty document already exists, prefer "patches" for edits; every create_element must use a pageId that exists in the current document JSON.
- page.backgroundColor solid hex; elements fully inside page width/height; x,y,width,height multiples of 8; min margin 64px from edges.
- Max 6 elements per page; zIndex starts at 1.
- Every element MUST include: id, kind, x, y, width, height, rotation (0), zIndex, opacity (1).
- text: kind:"text", content (NEVER empty), fontFamily, fontSize, fontWeight, fontStyle, color, textAlign, lineHeight.
- assistantNote: concise summary, max ~800 chars.`

/** Compact summary of prior agent phases — avoids unbounded JSON.stringify(bundle). */
export function summarizeSemanticBundle(
  intentPlan: IntentPlanPayload,
  tokens: DesignTokenBundle,
  layout: LayoutTree,
  maxChars = SEMANTIC_BUNDLE_MAX_CHARS,
): string {
  const regions = layout.regions
    .slice(0, 12)
    .map((r) => `${r.id}:${r.role}@${r.relativeRect.x.toFixed(2)},${r.relativeRect.y.toFixed(2)}`)
    .join("; ")
  const lines = [
    `Intent: ${intentPlan.intent.designType} | ${intentPlan.intent.tone} | ${intentPlan.intent.platform} | density:${intentPlan.intent.density}`,
    `Audience: ${intentPlan.intent.audience}`,
    `Content priority: ${intentPlan.intent.contentPriority.slice(0, 6).join(", ")}`,
    `Layout: ${intentPlan.plan.layoutType} | hierarchy: ${intentPlan.plan.visualHierarchy.slice(0, 5).join(" > ")}`,
    `Grid: ${intentPlan.plan.grid.columns} cols, safeMargin ${intentPlan.plan.grid.safeMargin}px`,
    `Fonts: heading=${tokens.tokens.headingFont}, body=${tokens.tokens.bodyFont}`,
    `Colors: ${JSON.stringify(tokens.tokens.colors)}`,
    `Regions (${layout.regions.length}): ${regions || "none"}`,
  ]
  let out = lines.join("\n")
  if (out.length > maxChars) out = `${out.slice(0, maxChars)}\n…[bundle truncated]`
  return out
}

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

export type ComposePromptOptions = {
  includeDocument?: boolean
  documentMaxChars?: number
}

export function buildComposePhaseSystemPrompt(
  document: DesignDocument | null,
  bundle: {
    intentPlan: IntentPlanPayload
    tokens: DesignTokenBundle
    layout: LayoutTree
  },
  opts?: ComposePromptOptions,
): string {
  const includeDoc = opts?.includeDocument !== false
  const docMax = opts?.documentMaxChars ?? 10_000
  const slim = includeDoc ? buildSlimDocumentContextForAgent(document, docMax) : "Omitted to save output tokens — use semantic bundle only."
  const summary = summarizeSemanticBundle(bundle.intentPlan, bundle.tokens, bundle.layout)
  const pageId = document?.pages[0]?.id

  return [
    JSON_ONLY,
    "You are stage 5: produce the final canvas as patches or a full document. Obey the semantic plan and tokens.",
    COMPOSE_SCHEMA_EXCERPT,
    COMPOSE_RULES,
    "",
    document
      ? `You are editing an existing document: prefer kind:"patches" unless a full redesign is clearly required. Use pageId: "${pageId ?? "see CURRENT DOCUMENT"}".`
      : "There is no document yet: you MUST emit kind:\"document\" with a complete DesignDocument (pages, theme, elements).",
    "",
    "Semantic summary:",
    summary,
    "",
    "CURRENT DOCUMENT (trimmed):",
    slim,
  ].join("\n")
}

/** Smaller compose prompt after truncation — drops document snapshot for new designs. */
export function buildComposeTruncationRetryPrompt(
  document: DesignDocument | null,
  bundle: { intentPlan: IntentPlanPayload; tokens: DesignTokenBundle; layout: LayoutTree },
): string {
  return buildComposePhaseSystemPrompt(document, bundle, {
    includeDocument: Boolean(document),
    documentMaxChars: document ? 4_000 : 0,
  })
}

export function buildComposeFallbackPrompt(
  document: DesignDocument | null,
  intentPlan: IntentPlanPayload,
  tokens: DesignTokenBundle,
  layout?: LayoutTree,
): string {
  const colors = tokens.tokens.colors
  const intent = intentPlan.intent
  const pageId = document?.pages[0]?.id ?? "page1"
  const pw = document?.pages[0]?.width ?? 1080
  const ph = document?.pages[0]?.height ?? 1080
  const regionLines =
    layout?.regions
      .slice(0, 8)
      .map((r) => `- ${r.id} (${r.role}): x=${r.relativeRect.x.toFixed(2)} y=${r.relativeRect.y.toFixed(2)} w=${r.relativeRect.w.toFixed(2)} h=${r.relativeRect.h.toFixed(2)}`)
      .join("\n") ?? ""

  return [
    JSON_ONLY,
    COMPOSE_SCHEMA_EXCERPT,
    document
      ? `Output ONLY {"kind":"patches","patches":[...],"assistantNote":"..."} with at most 6 create_element ops. REQUIRED pageId: "${pageId}".`
      : `Output ONLY {"kind":"document","document":{...},"assistantNote":"..."}. Page template: id="${pageId}", width:${pw}, height:${ph}, backgroundColor:"${colors.background ?? "#FFFFFF"}", elements:[...].`,
    "",
    "Canvas rules:",
    `- page ${pw}×${ph}, max 5 elements, zIndex from 1`,
    "- x/y/width/height multiples of 8, min 64px margin",
    "- text needs content, fontFamily, fontSize, fontWeight, fontStyle, color, textAlign, lineHeight",
    "",
    `Intent: ${intent.designType}, ${intent.tone}, ${intent.platform}`,
    `Layout type: ${intentPlan.plan.layoutType}`,
    `Hierarchy: ${intentPlan.plan.visualHierarchy.slice(0, 4).join(" > ")}`,
    `Fonts: ${tokens.tokens.headingFont} / ${tokens.tokens.bodyFont}`,
    `Colors: ${JSON.stringify(colors)}`,
    regionLines ? `\nLayout regions (place content in these areas):\n${regionLines}` : "",
  ].join("\n")
}

/** Elements-only compose — ~70% smaller JSON than full DesignDocument. */
export function buildComposeElementsOnlyPrompt(
  bundle: { intentPlan: IntentPlanPayload; tokens: DesignTokenBundle; layout: LayoutTree },
): string {
  const summary = summarizeSemanticBundle(bundle.intentPlan, bundle.tokens, bundle.layout, 2_000)
  return [
    JSON_ONLY,
    "You are stage 5 (compact mode): output ONLY this shape:",
    '{ "kind": "elements", "elements": [ /* DesignElement objects */ ], "assistantNote": string }',
    "Do NOT wrap in a full document. Provide 3–6 elements with all required fields.",
    COMPOSE_SCHEMA_EXCERPT,
    "",
    "Semantic summary:",
    summary,
    "",
    "Page is 1080×1080. Place elements inside bounds with 64px margin.",
  ].join("\n")
}

/** Hybrid compose — LLM fills text per layout region; positions are computed client-side. */
export function buildComposeHybridPrompt(
  bundle: { intentPlan: IntentPlanPayload; tokens: DesignTokenBundle; layout: LayoutTree },
): string {
  const regionSpec = bundle.layout.regions
    .map((r) => `{ "regionId": "${r.id}", "content": "<${r.role} text>" }`)
    .join(",\n  ")
  return [
    JSON_ONLY,
    "You are stage 5 (region mode): output ONLY:",
    '{ "kind": "region_contents", "regionContents": [',
    `  ${regionSpec}`,
    "  ],",
    '  "assistantNote": string }',
    "",
    "Write real copy for each regionId from the user request. One string per region.",
    `Fonts: heading=${bundle.tokens.tokens.headingFont}, body=${bundle.tokens.tokens.bodyFont}`,
    `Tone: ${bundle.intentPlan.intent.tone}`,
    "",
    summarizeSemanticBundle(bundle.intentPlan, bundle.tokens, bundle.layout, 2_000),
  ].join("\n")
}

/** Last-resort: reuse proven one-shot prompt with agent context prefix. */
export function buildEnrichedOneShotComposePrompt(
  document: DesignDocument | null,
  bundle: { intentPlan: IntentPlanPayload; tokens: DesignTokenBundle; layout: LayoutTree },
  userMessage: string,
): string {
  const base = buildDesignSystemPrompt(document)
  const prefix = [
    "Prior agent phases completed. Use this semantic summary:",
    summarizeSemanticBundle(bundle.intentPlan, bundle.tokens, bundle.layout),
    "",
    `User request: ${userMessage}`,
    "",
  ].join("\n")
  return `${prefix}${base}`
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
