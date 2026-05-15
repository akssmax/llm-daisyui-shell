import { jsonrepair } from "jsonrepair"
import { nanoid } from "nanoid"
import type { DesignAiResponse, DesignDocument, DesignElement, DocumentType, PatchOp, ShapeKind, Theme } from "../types"
import { extractIconNameFromText, normalizeIconName } from "./lucide-icon-registry"

/** User-visible fallback when the model output is not valid design JSON (avoid Cursor-like generic copy). */
export const DESIGN_MODEL_PARSE_FAILED_MESSAGE =
  "Could not read the model's design reply (it must be one JSON object). Try again, or ask for a smaller change."

export const DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE =
  "The design reply looks cut off before the JSON finished. Use Continue if offered, shorten the request, or try again."

const DEFAULT_THEME: Theme = {
  primaryColor: "#0f172a",
  secondaryColor: "#64748b",
  accentColor: "#3b82f6",
  backgroundColor: "#ffffff",
  fontFamily: "Inter",
}

const DOCUMENT_TYPES: DocumentType[] = ["carousel", "slide", "social-post"]

function isValidDocument(obj: unknown): obj is DesignDocument {
  if (!obj || typeof obj !== "object") return false
  const d = obj as Record<string, unknown>
  return (
    typeof d.id === "string" &&
    typeof d.title === "string" &&
    Array.isArray(d.pages) &&
    d.pages.length > 0 &&
    typeof d.theme === "object" &&
    d.theme !== null &&
    !Array.isArray(d.theme)
  )
}

/** Mistral / agent compose often omits theme keys or wraps payloads; coerce when structure is close enough. */
function coerceDesignDocument(doc: unknown): DesignDocument | null {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null
  const d = doc as Record<string, unknown>
  if (typeof d.id !== "string" || typeof d.title !== "string" || !Array.isArray(d.pages) || d.pages.length === 0) {
    return null
  }
  const rawType = d.type
  const type: DocumentType =
    typeof rawType === "string" && DOCUMENT_TYPES.includes(rawType as DocumentType)
      ? (rawType as DocumentType)
      : "social-post"
  const t = d.theme && typeof d.theme === "object" && !Array.isArray(d.theme) ? (d.theme as Record<string, unknown>) : {}
  const theme: Theme = {
    primaryColor: typeof t.primaryColor === "string" ? t.primaryColor : DEFAULT_THEME.primaryColor,
    secondaryColor: typeof t.secondaryColor === "string" ? t.secondaryColor : DEFAULT_THEME.secondaryColor,
    accentColor: typeof t.accentColor === "string" ? t.accentColor : DEFAULT_THEME.accentColor,
    backgroundColor: typeof t.backgroundColor === "string" ? t.backgroundColor : DEFAULT_THEME.backgroundColor,
    fontFamily: typeof t.fontFamily === "string" ? t.fontFamily : DEFAULT_THEME.fontFamily,
  }
  const now = new Date().toISOString()
  const pages = d.pages.map((p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return null
    const pg = p as Record<string, unknown>
    if (typeof pg.id !== "string") return null
    const width = typeof pg.width === "number" && Number.isFinite(pg.width) ? pg.width : 1080
    const height = typeof pg.height === "number" && Number.isFinite(pg.height) ? pg.height : 1080
    const backgroundColor =
      typeof pg.backgroundColor === "string" && pg.backgroundColor.length > 0 ? pg.backgroundColor : "#FFFFFF"
    const rawEls = Array.isArray(pg.elements) ? pg.elements : []
    const elements: DesignElement[] = rawEls
      .map((el, idx) => coerceElement(el, idx))
      .filter((el): el is DesignElement => el !== null)
    return { id: pg.id, width, height, backgroundColor, elements }
  })
  if (pages.some((p) => p === null)) return null
  return {
    id: d.id,
    title: d.title,
    type,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : now,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : now,
    theme,
    pages: pages as DesignDocument["pages"],
  }
}

const VALID_KINDS = new Set(["text", "image", "shape", "icon"])
const VALID_SHAPES: ShapeKind[] = ["rectangle", "ellipse", "triangle", "line", "arrow", "polygon", "star"]
const TEXT_ALIGNS = new Set(["left", "center", "right"])

function normalizeKindString(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const lower = raw.trim().toLowerCase()
  if (VALID_KINDS.has(lower)) return lower
  // common model hallucinations
  if (lower === "rect" || lower === "rectangle" || lower === "box" || lower === "background") return "shape"
  if (lower === "img" || lower === "photo") return "image"
  if (lower === "label" || lower === "heading" || lower === "paragraph" || lower === "body" || lower === "caption") return "text"
  return null
}

function normalizeShapeKind(raw: unknown): ShapeKind {
  if (typeof raw === "string") {
    const lower = raw.trim().toLowerCase() as ShapeKind
    if (VALID_SHAPES.includes(lower)) return lower
    if (lower === "rect" || lower === "box" || lower === "square") return "rectangle"
    if (lower === "circle" || lower === "oval") return "ellipse"
  }
  return "rectangle"
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && (v as string).trim().length > 0 ? (v as string).trim() : fallback
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback
}

export function coerceElement(raw: unknown, index: number): DesignElement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const e = raw as Record<string, unknown>

  const kind = normalizeKindString(e.kind ?? e.type ?? e.elementType)
  if (!kind) return null

  const id = str(e.id, `el${nanoid(6)}`)
  const base = {
    id,
    x: num(e.x, 64),
    y: num(e.y, 64 + index * 120),
    width: num(e.width, 400),
    height: num(e.height, 80),
    rotation: num(e.rotation, 0),
    zIndex: num(e.zIndex ?? e.z, index + 1),
    opacity: num(e.opacity, 1),
  }

  if (kind === "text") {
    const rawText = str(e.content ?? e.text ?? e.label ?? e.value, "Text")
    const iconFromText = extractIconNameFromText(rawText)
    if (iconFromText) {
      return {
        ...base,
        kind: "icon",
        iconName: iconFromText,
        color: str(e.color ?? e.fill ?? e.textColor, "#000000"),
      }
    }
    const align = TEXT_ALIGNS.has(str(e.textAlign ?? e.align, "")) ? str(e.textAlign ?? e.align, "") as "left" | "center" | "right" : "left"
    return {
      ...base,
      kind: "text",
      content: rawText,
      fontFamily: str(e.fontFamily ?? e.font, DEFAULT_THEME.fontFamily),
      fontSize: num(e.fontSize ?? e.size, 24),
      fontWeight: str(e.fontWeight ?? e.weight, "normal"),
      fontStyle: e.fontStyle === "italic" ? "italic" : "normal",
      color: str(e.color ?? e.textColor ?? e.fill, "#000000"),
      textAlign: align || "left",
      lineHeight: num(e.lineHeight, 1.4),
      ...(typeof e.backgroundColor === "string" && e.backgroundColor ? { backgroundColor: e.backgroundColor } : {}),
    }
  }

  if (kind === "shape") {
    return {
      ...base,
      kind: "shape",
      shape: normalizeShapeKind(e.shape ?? e.shapeType),
      fill: str(e.fill ?? e.color ?? e.backgroundColor, "#E2E8F0"),
      ...(typeof e.stroke === "string" ? { stroke: e.stroke } : {}),
      ...(typeof e.strokeWidth === "number" ? { strokeWidth: e.strokeWidth } : {}),
      ...(typeof e.borderRadius === "number" ? { borderRadius: e.borderRadius } : {}),
    }
  }

  if (kind === "image") {
    return {
      ...base,
      kind: "image",
      src: str(e.src ?? e.url ?? e.href, ""),
      objectFit: e.objectFit === "contain" ? "contain" : e.objectFit === "fill" ? "fill" : "cover",
      ...(typeof e.borderRadius === "number" ? { borderRadius: e.borderRadius } : {}),
    }
  }

  if (kind === "icon") {
    const rawIcon = str(e.iconName ?? e.icon ?? e.name, "star")
    const iconName = normalizeIconName(rawIcon) ?? extractIconNameFromText(rawIcon) ?? "star"
    return {
      ...base,
      kind: "icon",
      iconName,
      color: str(e.color ?? e.fill, "#000000"),
    }
  }

  return null
}

function unwrapDesignAiEnvelope(obj: unknown): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj
  const r = obj as Record<string, unknown>
  const keys = ["response", "output", "result", "data", "design", "canvas", "payload"] as const
  for (const k of keys) {
    const inner = r[k]
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const ir = inner as Record<string, unknown>
      if (typeof ir.kind === "string" || typeof ir.Kind === "string" || typeof ir.KIND === "string") return inner
      if ("document" in ir || "patches" in ir) return inner
    }
  }
  return obj
}

function normalizeStringifiedPayloadFields(rec: Record<string, unknown>): Record<string, unknown> {
  let out = { ...rec }
  if (typeof out.document === "string") {
    const parsed = parseJsonMaybeRepaired(out.document.trim())
    if (parsed !== null) out = { ...out, document: parsed }
  }
  if (typeof out.patches === "string") {
    const parsed = parseJsonMaybeRepaired(out.patches.trim())
    if (parsed !== null) out = { ...out, patches: parsed }
  }
  return out
}

/** Skip leading prose so `extractRootLevelJsonObjects` can find the payload. */
function stripLeadingNonJsonPrefix(s: string): string {
  const t = s.trim().replace(/^\uFEFF/, "")
  const idx = t.search(/[\[{]/)
  if (idx <= 0) return t
  return t.slice(idx)
}

const MAX_ASSISTANT_NOTE_CHARS = 800

function trimAssistantNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const t = value.trim()
  if (!t) return undefined
  return t.length > MAX_ASSISTANT_NOTE_CHARS ? t.slice(0, MAX_ASSISTANT_NOTE_CHARS) : t
}

function isValidPatches(arr: unknown): arr is PatchOp[] {
  if (!Array.isArray(arr)) return false
  return arr.every(
    (op) => op && typeof op === "object" && typeof (op as Record<string, unknown>).op === "string",
  )
}

function parseJsonMaybeRepaired(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(jsonrepair(raw))
    } catch {
      return null
    }
  }
}

/** Normalize `Kind` / `KIND` → `kind` for model drift. */
function normalizeKindKey(obj: unknown): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj
  const r = obj as Record<string, unknown>
  if (typeof r.kind === "string") return obj
  const alt = r.Kind ?? r.KIND
  if (typeof alt === "string") {
    const { Kind: _K, KIND: _k2, ...rest } = r
    return { ...rest, kind: alt.toLowerCase() }
  }
  return obj
}

/**
 * Top-level `{ ... }` spans where `{` / `}` inside JSON strings do not change depth.
 * Fixes false failures when e.g. `"text":"Use } for emphasis"` or code samples appear in strings.
 */
function extractRootLevelJsonObjects(s: string): string[] {
  const objects: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === "\\") escape = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === "{") {
      if (depth === 0) start = i
      depth++
    } else if (c === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        objects.push(s.slice(start, i + 1))
        start = -1
      }
    }
  }
  return objects
}

/** True if `{`/`}` depth never returns to zero (truncated stream or invalid). */
function hasUnbalancedJsonBraces(s: string): boolean {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === "\\") escape = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === "{") depth++
    else if (c === "}") depth--
  }
  return depth !== 0
}

function debugParseFailure(raw: string): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") return
  const t = raw.trim()
  let h = 0
  const cap = Math.min(t.length, 8000)
  for (let i = 0; i < cap; i++) h = (h * 31 + t.charCodeAt(i)) | 0
  console.warn("[design-json-parser] parse failed", { length: t.length, sampleHash: h })
}

export function tryParseDesignCandidate(t: string): DesignAiResponse | null {
  let trimmed = t.trim()
  if (!trimmed) return null

  // Entire payload is a JSON string containing the real object (some gateways / models).
  for (let depth = 0; depth < 4 && trimmed.startsWith('"'); depth += 1) {
    try {
      const once = JSON.parse(trimmed)
      if (typeof once !== "string") break
      trimmed = once.trim()
    } catch {
      break
    }
  }

  if (trimmed.startsWith("[")) {
    const arr = parseJsonMaybeRepaired(trimmed)
    if (arr !== null) {
      const r = interpretParsedObject(arr)
      if (r) return r
    }
  }

  const directParsed = parseJsonMaybeRepaired(trimmed)
  if (directParsed !== null) {
    const r = interpretParsedObject(normalizeKindKey(directParsed))
    if (r) return r
  }

  const roots = extractRootLevelJsonObjects(trimmed)
  for (let i = roots.length - 1; i >= 0; i--) {
    const parsed = parseJsonMaybeRepaired(roots[i]!)
    if (parsed === null) continue
    const result = interpretParsedObject(normalizeKindKey(parsed))
    if (result) return result
  }
  return null
}

/** Strip thinking / reasoning wrappers (may wrap fenced JSON). */
function stripThinkingWrappers(s: string): string {
  return s
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<redacted[_\s-]*think(?:ing)?>[\s\S]*?<\/redacted[_\s-]*think(?:ing)?>/gi, "")
    .trim()
}

/**
 * Split on ``` so we capture every fenced segment. Odd segments are inside fences.
 * e.g. `intro\`\`\`json\n{...}\n\`\`\`outro` → ["intro", "json\n{...}\n", "outro"]
 */
function extractMarkdownFenceBodies(text: string): string[] {
  const parts = text.split("```")
  const bodies: string[] = []
  for (let i = 1; i < parts.length; i += 2) {
    let body = parts[i] ?? ""
    body = body.replace(/^json\b\s*/i, "").trimStart()
    body = body.replace(/^\s*\r?\n/, "").trim()
    if (body.length > 0) bodies.push(body)
  }
  return bodies
}

/** When ```json is opened but never closed (truncated stream), still try the tail as JSON. */
function extractOpenMarkdownJsonFence(text: string): string | null {
  const parts = text.split("```")
  if (parts.length < 2 || parts.length % 2 !== 0) return null
  const re = /```(?:json)?\s*\r?\n/i
  const m = re.exec(text)
  if (!m) return null
  const after = text.slice(m.index + m[0].length).trim()
  return after.length >= 2 ? after : null
}

function pushUnique(out: string[], s: string) {
  const t = s.trim().replace(/^\uFEFF/, "")
  if (!t || out.includes(t)) return
  out.push(t)
}

/**
 * Build ordered candidate strings to parse. Models often put JSON inside a markdown fence
 * (sometimes the only closing ``` is missing until the end — we still try the tail).
 */
export function collectDesignJsonCandidates(raw: string): string[] {
  const out: string[] = []
  const base = stripThinkingWrappers(raw)

  const fenceBodies = extractMarkdownFenceBodies(base)
  // Prefer the last fenced block first (final answer often after thinking / drafts).
  for (let i = fenceBodies.length - 1; i >= 0; i--) {
    pushUnique(out, fenceBodies[i]!)
  }

  const openFenceBody = extractOpenMarkdownJsonFence(base)
  if (openFenceBody) pushUnique(out, openFenceBody)

  const strippedBase = stripLeadingNonJsonPrefix(base)
  pushUnique(out, strippedBase)

  // Whole string after stripping thinking (handles "JSON only" or prose + JSON)
  pushUnique(out, base)

  // Original trim (thinking tags might only exist in the middle)
  const trimmedRaw = raw.trim()
  pushUnique(out, trimmedRaw)
  pushUnique(out, stripLeadingNonJsonPrefix(trimmedRaw))

  return out
}

/**
 * @deprecated Prefer collectDesignJsonCandidates + tryParseDesignCandidate; kept for tests / callers.
 */
export function normalizeRawDesignResponse(raw: string): string {
  const c = collectDesignJsonCandidates(raw)
  return c[0] ?? raw.trim()
}

function interpretParsedObject(obj: unknown): DesignAiResponse | null {
  let cur: unknown = unwrapDesignAiEnvelope(obj)
  cur = normalizeKindKey(cur)

  if (Array.isArray(cur) && isValidPatches(cur)) {
    return { kind: "patches", patches: cur }
  }
  if (!cur || typeof cur !== "object") return null

  let response = normalizeStringifiedPayloadFields(cur as Record<string, unknown>)
  response = normalizeKindKey(response) as Record<string, unknown>

  if (response.kind === "document") {
    const note = trimAssistantNote(response.assistantNote)
    let doc: DesignDocument | null = null
    if (isValidDocument(response.document)) {
      // Even if structure is valid, elements may have malformed fields — coerce anyway.
      doc = coerceDesignDocument(response.document) ?? (response.document as DesignDocument)
    } else if (response.document) {
      doc = coerceDesignDocument(response.document)
    }
    if (doc) {
      return {
        kind: "document",
        document: doc,
        ...(note ? { assistantNote: note } : {}),
      }
    }
  }

  if (response.kind === "patches" && isValidPatches(response.patches)) {
    const note = trimAssistantNote(response.assistantNote)
    return {
      kind: "patches",
      patches: response.patches as PatchOp[],
      ...(note ? { assistantNote: note } : {}),
    }
  }

  if (response.kind === "message" && typeof response.text === "string") {
    const note = trimAssistantNote(response.assistantNote)
    return {
      kind: "message",
      text: response.text,
      ...(note ? { assistantNote: note } : {}),
    }
  }

  if (isValidDocument(cur)) {
    const rec = cur as Record<string, unknown>
    const note = trimAssistantNote(rec.assistantNote)
    const doc = coerceDesignDocument(cur) ?? (cur as DesignDocument)
    return {
      kind: "document",
      document: doc,
      ...(note ? { assistantNote: note } : {}),
    }
  }

  const coercedBare = coerceDesignDocument(cur)
  if (coercedBare) {
    const rec = cur as Record<string, unknown>
    const note = trimAssistantNote(rec.assistantNote)
    return {
      kind: "document",
      document: coercedBare,
      ...(note ? { assistantNote: note } : {}),
    }
  }

  return null
}

export function extractJsonFromStream(raw: string): DesignAiResponse {
  const candidates = collectDesignJsonCandidates(raw)
  for (const c of candidates) {
    const result = tryParseDesignCandidate(c)
    if (result) return result
  }
  const flat = raw.trim()
  const repaired = parseJsonMaybeRepaired(flat)
  if (repaired !== null) {
    const fromRepair = interpretParsedObject(normalizeKindKey(repaired))
    if (fromRepair) return fromRepair
  }
  if (flat.length > 0 && hasUnbalancedJsonBraces(flat) && /"kind"\s*:|"Kind"\s*:/i.test(flat)) {
    return { kind: "message", text: DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE }
  }
  debugParseFailure(raw)
  return { kind: "message", text: DESIGN_MODEL_PARSE_FAILED_MESSAGE }
}
