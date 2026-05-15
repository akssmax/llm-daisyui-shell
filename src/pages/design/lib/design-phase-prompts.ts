import type { DesignDocument } from "../types"
import { buildDesignSystemPrompt, buildSlimDocumentContextForAgent, COMPOSE_SCHEMA_EXCERPT } from "./design-prompt"
import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "./design-agent-schemas"
import { retrieveDesignPatterns } from "./design-pattern-retrieval"
import type { LayoutPattern } from "./layout-intelligence/types"
import { silhouettesForPrompt } from "./agent-silhouette-registry"
import { patternsForPrompt } from "./fill-pattern-catalog"
import { lucideAllowlistForPrompt } from "./lucide-icon-registry"
import { tailwindThemePromptList } from "./layout-intelligence/tailwind-theme-builder"
import { canvasFormatsForPrompt } from "./layout-intelligence/canvas-spec"
import type { CanvasPresetMode } from "./design-presets"

const JSON_ONLY = "Reply with ONLY one JSON object (no markdown fences, no prose). The API uses JSON mode."

const SEMANTIC_BUNDLE_MAX_CHARS = 3_500

const COMPOSE_RULES = `Canvas JSON rules (critical):
- Output exactly ONE JSON object: either {"kind":"document","document":DesignDocument,"assistantNote":string} OR {"kind":"patches","patches":[PatchOp,...],"assistantNote":string} OR {"kind":"message","text":string}.
- If CURRENT DOCUMENT is missing or has zero elements, you MUST return {"kind":"document",...} with a full DesignDocument including at least one text or shape on page 0. Do NOT return {"kind":"patches"} when there is no document to patch.
- When a non-empty document already exists, prefer "patches" for edits; every create_element must use a pageId that exists in the current document JSON.
- Each slide/card = one page. Never put slide 2+ content on pages[0]. To add slides use { op:"create_page", page:{ id, width, height, backgroundColor, elements:[...] } } with a NEW page id per slide.
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

export function buildIntentPlanSystemPrompt(
  userMessage: string,
  canvasMode: CanvasPresetMode = "auto",
): string {
  const patterns = retrieveDesignPatterns(userMessage, 3200)
  const canvasLocked =
    canvasMode !== "auto"
      ? `Canvas is LOCKED to preset "${canvasMode}" — use that format's width×height in plan.canvas.`
      : "Choose the best canvas format from the catalog below based on the user request (resume→resume/a4-portrait, cover letter→cover-letter, poster→poster-a3, email→email-header or email-newsletter, website hero→website-hero, etc.)."

  return [
    "You are stage 1–2 of a design agent: semantic intent + layout plan + canvas size. Do NOT output canvas elements or coordinates.",
    JSON_ONLY,
    "",
    "Return exactly this shape:",
    `{ "intent": { "designType": string, "tone": string, "platform": string, "density": "minimal"|"normal"|"dense", "contentPriority": string[], "audience": string },`,
    `  "plan": { "layoutType": string, "visualHierarchy": string[], "grid": { "columns": number, "safeMargin": number }, "spacingStrategy": { "baseUnit": number, "sectionGap": number }, "slideCount": number,`,
    `    "canvas": { "width": number, "height": number, "format": string, "documentType": "carousel"|"slide"|"social-post"|"document"|"poster"|"email" } } }`,
    "",
    canvasLocked,
    "plan.canvas is REQUIRED. Pick width/height from the format catalog (or custom dimensions for unusual requests).",
    "",
    "Format catalog:",
    canvasFormatsForPrompt(),
    "",
    "For carousels, decks, or multi-slide requests: set plan.slideCount to the number of slides (e.g. 5 for a 5-slide LinkedIn carousel). Single-image posts use slideCount: 1.",
    "Print/documents (resume, cover letter, A4): use slideCount 1, documentType document, safeMargin 48–64.",
    "",
    "Internal design knowledge (follow unless user conflicts):",
    patterns,
  ].join("\n")
}

export function buildDesignSystemPhasePrompt(userMessage: string, ip: IntentPlanPayload): string {
  const patterns = retrieveDesignPatterns(`${userMessage} ${ip.plan.layoutType}`, 2400)
  const hues = tailwindThemePromptList()
  return [
    "You are stage 3: pick a Tailwind-based color theme. Do NOT output canvas elements or arbitrary hex colors.",
    JSON_ONLY,
    "",
    "Return exactly:",
    `{ "accentHue": "<one of allowlist>", "mode": "light" | "dark" }`,
    "",
    `accentHue MUST be one of: ${hues}`,
    "Choose accentHue from user intent (e.g. eco→emerald, finance→blue, health→teal, energy→orange). Default accentHue: indigo, mode: light.",
    "Use mode dark only when the user clearly wants a dark theme.",
    "Never use neon yellow or harsh brutalist colors unless the user explicitly said brutalist.",
    "",
    "Intent + plan:",
    JSON.stringify(ip),
    "",
    "User message:",
    userMessage,
    "",
    "Knowledge:",
    patterns,
  ].join("\n")
}

function regionConstraintHints(layout: LayoutTree): string {
  const c = layout.constraints?.regions
  if (!c) return ""
  return layout.regions
    .map((r) => {
      const rc = c[r.id]
      if (!rc) return null
      const parts: string[] = []
      if (rc.maxChars) parts.push(`maxChars:${rc.maxChars}`)
      if (rc.maxLines) parts.push(`maxLines:${rc.maxLines}`)
      if (rc.visualWeight) parts.push(`weight:${rc.visualWeight}`)
      return parts.length ? `${r.id}(${r.role}): ${parts.join(", ")}` : null
    })
    .filter(Boolean)
    .join("\n")
}

export function buildContentStructurePhasePrompt(
  userMessage: string,
  ip: IntentPlanPayload,
  layout?: LayoutTree,
): string {
  const patterns = retrieveDesignPatterns(`${userMessage} content structure`, 2800)
  const hints = layout ? regionConstraintHints(layout) : ""
  return [
    "You are stage 3a: decompose the user request into structured copy fields. Do NOT output coordinates or canvas elements.",
    JSON_ONLY,
    "",
    "Return exactly:",
    `{ "contentStructure": {`,
    `  "headline": string, "subheading": string, "body": string,`,
    `  "cta": string, "stats": string[], "quote": string, "tone": string`,
    `}}`,
    "",
    "Only include fields relevant to the request. Write full, benefit-driven copy.",
    hints ? `\nSuggested limits:\n${hints}` : "",
    "",
    "Intent + plan:",
    JSON.stringify(ip),
    "",
    layout
      ? `Layout regions (hints): ${layout.regions.map((r) => `${r.id}:${r.role}`).join(", ")}`
      : "Use semantic fields: headline, subheading, body, cta, stats, quote.",
    "",
    "User message:",
    userMessage,
    "",
    "Design principles:",
    patterns,
  ].join("\n")
}

const SEMANTIC_REGION_SPEC = [
  `{ "regionId": "headline", "content": "<primary headline>" }`,
  `{ "regionId": "subheading", "content": "<optional subhead>" }`,
  `{ "regionId": "body", "content": "<body copy>" }`,
  `{ "regionId": "visual", "content": "icon kind=<kebab-case from allowlist>" }`,
  `{ "regionId": "footer", "content": "<CTA line with arrow>" }`,
  `{ "regionId": "cta", "content": "<call to action>" }`,
  `{ "regionId": "quote", "content": "<testimonial>" }`,
  `{ "regionId": "stat", "content": "<metric value>" }`,
].join(",\n    ")

export function buildContentMapPhasePrompt(
  userMessage: string,
  ip: IntentPlanPayload,
  layout: LayoutTree | null,
  _tokens: DesignTokenBundle,
  slideCount = 1,
  contentStructure?: import("./design-agent-schemas").ContentStructure,
): string {
  const iconList = lucideAllowlistForPrompt()
  const silhouetteList = silhouettesForPrompt()
  const patternList = patternsForPrompt()
  const patterns = retrieveDesignPatterns(`${userMessage} ${ip.intent.tone}`, 2000)
  const hints = layout ? regionConstraintHints(layout) : ""
  const structureBlock = contentStructure
    ? `\nStructured copy (map to matching regions):\n${JSON.stringify(contentStructure, null, 0)}`
    : ""
  const regionSpec = layout
    ? layout.regions
        .map((r) => {
          const rc = layout.constraints?.regions[r.id]
          const limit = rc?.maxChars ? ` max ${rc.maxChars} chars` : ""
          if (r.role === "icon") {
            return `{ "regionId": "${r.id}", "kind": "icon", "iconName": "<kebab-case from allowlist>" }`
          }
          return `{ "regionId": "${r.id}", "content": "<copy for ${r.role}${limit}>" }`
        })
        .join(",\n    ")
    : SEMANTIC_REGION_SPEC
  const iconRules = [
    "For semantic UI icons: \"icon kind=<name>\" OR kind:\"icon\" + iconName from allowlist.",
    `Icon allowlist: ${iconList}`,
    "For decorative blobs (not UI icons): \"silhouette kind=<Name>\" OR kind:\"silhouette\" + shapeName.",
    `Silhouette shapes (PascalCase): ${silhouetteList}`,
    "Optional page/region pattern: \"pattern: grid-light\" or patternId on region.",
    `Pattern ids: ${patternList}`,
    "Match semantics: CTA→arrow-right, trust→shield, decorative→Heart/Burst/Soft burst.",
    "Write FULL copy — do not truncate. Layout will be chosen after content mapping.",
    "One dominant focal point per slide.",
  ].join("\n")

  if (slideCount > 1) {
    return [
      `You are stage 4b: map structured copy to ${slideCount} slides.`,
      "CRITICAL: Each slide is a SEPARATE page. Put ONLY that slide's content in its regionContents.",
      JSON_ONLY,
      "",
      `Return: { "slideCount": ${slideCount}, "slides": [`,
      `  { "slideIndex": 0, "regionContents": [ ${regionSpec} ] },`,
      "  ... one entry per slide",
      "  ],",
      '  "assistantNote": string }',
      "",
      iconRules,
      hints ? `Region limits:\n${hints}` : "",
      structureBlock,
      `Tone: ${ip.intent.tone} · Platform: ${ip.intent.platform}`,
      "",
      "Design principles:",
      patterns,
      "",
      "User message:",
      userMessage,
    ].join("\n")
  }

  return [
    "You are stage 4b: map structured copy to layout regions. Do NOT output x/y/width/height.",
    JSON_ONLY,
    "",
    'Return: { "regionContents": [',
    `  ${regionSpec}`,
    "  ],",
    '  "assistantNote": string }',
    "",
    iconRules,
    hints ? `Region limits:\n${hints}` : "",
    structureBlock,
    `Tone: ${ip.intent.tone} · Platform: ${ip.intent.platform}`,
    "",
    "Design principles:",
    patterns,
    "",
    "User message:",
    userMessage,
  ].join("\n")
}

export function buildContentMapRefinementPrompt(
  userMessage: string,
  ip: IntentPlanPayload,
  layout: LayoutTree,
  tokens: DesignTokenBundle,
  issuesSummary: string,
  contentStructure?: import("./design-agent-schemas").ContentStructure,
): string {
  return [
    buildContentMapPhasePrompt(userMessage, ip, layout, tokens, 1, contentStructure),
    "",
    "REFINEMENT — previous output failed quality validation. Fix these issues:",
    issuesSummary,
    "Shorten or rewrite copy to respect maxChars per region. Keep the same layout region ids.",
  ].join("\n")
}

export function buildLayoutSelectPhasePrompt(
  userMessage: string,
  ip: IntentPlanPayload,
  candidates: LayoutPattern[],
  contentProfile?: import("./layout-intelligence/content-profile").ContentProfile,
): string {
  const catalog = candidates.map((l) => ({
    id: l.id,
    category: l.category,
    archetype: l.archetype,
    styleTags: l.styleTags,
    density: l.density,
    hierarchy: l.hierarchy,
    regions: l.regions.map((r) => ({ id: r.id, role: r.role, importance: r.importance })),
    constraints: l.constraints?.regions,
  }))
  const patterns = retrieveDesignPatterns(userMessage, 2000)
  return [
    "You are stage 5: pick ONE layout that best fits the mapped content. Do NOT invent geometry.",
    JSON_ONLY,
    "",
    'Return: { "layoutId": string, "reason": string }',
    "layoutId MUST be one of the candidate ids below.",
    "Prefer layouts whose regions can fit the headline/body lengths and icon needs.",
    "",
    "Intent + plan:",
    JSON.stringify(ip),
    "",
    contentProfile ? `Content profile:\n${JSON.stringify(contentProfile, null, 0)}` : "",
    "",
    "Layout candidates:",
    JSON.stringify(catalog, null, 0),
    "",
    "Design principles:",
    patterns,
    "",
    "User message:",
    userMessage,
  ].join("\n")
}

/** Stricter retry when multi-slide content_map did not return slides[]. */
export function buildContentMapRetryPrompt(
  userMessage: string,
  ip: IntentPlanPayload,
  layout: LayoutTree | null,
  tokens: DesignTokenBundle,
  slideCount: number,
): string {
  return [
    buildContentMapPhasePrompt(userMessage, ip, layout, tokens, slideCount),
    "",
    "RETRY — your previous response was invalid.",
    `You MUST return { "slideCount": ${slideCount}, "slides": [ ... ] } with exactly ${slideCount} slide objects.`,
    "Do NOT return flat regionContents. Each slides[i].regionContents is ONLY for that slideIndex.",
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
  /** 0-based index when the user asked to edit a specific slide/page */
  targetSlideIndex?: number | null
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
  const pageIds = document?.pages.map((p, i) => `pages[${i}].id="${p.id}"`) ?? []
  const multiSlideRules = document && document.pages.length > 0
    ? [
        "MULTI-SLIDE RULES (critical):",
        `- Existing page ids: ${pageIds.join(", ") || "none"}.`,
        "- Each slide/card = one page. Never put slide 2+ content on pages[0].",
        '- To add slides: emit { op: "create_page", page: { id, width, height, backgroundColor, elements: [...] } } once per new slide.',
        "- New pages need NEW unique ids (e.g. pg_new_1). Max 6 elements per page.",
        "- Do NOT stack multiple slides worth of elements on a single page.",
      ].join("\n")
    : ""

  const targetIdx = opts?.targetSlideIndex
  const targetSlideRules =
    targetIdx != null && document && document.pages[targetIdx]
      ? [
          "TARGET SLIDE (critical):",
          `- User requested changes ONLY on slide ${targetIdx + 1} (pages[${targetIdx}], pageId="${document.pages[targetIdx].id}").`,
          "- Use that pageId for all patch ops. Do not add elements to any other page.",
          "- Prefer deleting existing elements on that page and recreating, or patch only that page.",
        ].join("\n")
      : ""

  return [
    JSON_ONLY,
    "You are stage 5: produce the final canvas as patches or a full document. Obey the semantic plan and tokens.",
    COMPOSE_SCHEMA_EXCERPT,
    COMPOSE_RULES,
    multiSlideRules,
    targetSlideRules,
    "",
    document
      ? `You are editing an existing document (${document.pages.length} page(s)): prefer kind:"patches" unless a full redesign is clearly required. Use pageId from the list above — never reuse pages[0] for new slides.`
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
  opts?: Pick<ComposePromptOptions, "targetSlideIndex">,
): string {
  return buildComposePhaseSystemPrompt(document, bundle, {
    includeDocument: Boolean(document),
    documentMaxChars: document ? 4_000 : 0,
    targetSlideIndex: opts?.targetSlideIndex,
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
  const iconList = lucideAllowlistForPrompt()
  const silhouetteList = silhouettesForPrompt()
  const patternList = patternsForPrompt()
  const regionSpec = bundle.layout.regions
    .map((r) => {
      if (r.role === "icon") {
        return `{ "regionId": "${r.id}", "kind": "icon", "iconName": "<kebab-case from allowlist>" }`
      }
      return `{ "regionId": "${r.id}", "content": "<${r.role} text>" }`
    })
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
    "For icon regions: use kind icon + iconName from allowlist.",
    `Icon allowlist: ${iconList}`,
    "For decorative blobs: silhouette kind=<Name> or kind silhouette + shapeName.",
    `Silhouette shapes: ${silhouetteList}`,
    `Pattern ids (optional): ${patternList}`,
    "Replace emojis with icons when the user asks (e.g. rocket, sparkles, arrow-right).",
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
