import type { DesignAiResponse, DesignDocument, PatchOp } from "../types"

/** User-visible fallback when the model output is not valid design JSON (avoid Cursor-like generic copy). */
export const DESIGN_MODEL_PARSE_FAILED_MESSAGE =
  "Could not read the model's design reply (it must be one JSON object). Try again, or ask for a smaller change."

function isValidDocument(obj: unknown): obj is DesignDocument {
  if (!obj || typeof obj !== "object") return false
  const d = obj as Record<string, unknown>
  return (
    typeof d.id === "string" &&
    typeof d.title === "string" &&
    Array.isArray(d.pages) &&
    d.pages.length > 0 &&
    typeof d.theme === "object"
  )
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

function extractLargestObject(text: string): string | null {
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i
      depth++
    } else if (text[i] === "}") {
      depth--
      if (depth === 0 && start !== -1) return text.slice(start, i + 1)
    }
  }
  return null
}

function parseJsonLoose(raw: string): unknown {
  const t = raw.trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const extracted = extractLargestObject(t)
    if (extracted) {
      try {
        return JSON.parse(extracted)
      } catch {
        return null
      }
    }
    return null
  }
}

/** Strip thinking / reasoning wrappers (may wrap fenced JSON). */
function stripThinkingWrappers(s: string): string {
  return s
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
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

  // Whole string after stripping thinking (handles "JSON only" or prose + JSON)
  pushUnique(out, base)

  // Original trim (thinking tags might only exist in the middle)
  pushUnique(out, raw.trim())

  return out
}

/**
 * @deprecated Prefer collectDesignJsonCandidates + parseJsonLoose; kept for tests / callers.
 */
export function normalizeRawDesignResponse(raw: string): string {
  const c = collectDesignJsonCandidates(raw)
  return c[0] ?? raw.trim()
}

function interpretParsedObject(obj: unknown): DesignAiResponse | null {
  if (!obj || typeof obj !== "object") return null
  const response = obj as Record<string, unknown>

  if (response.kind === "document" && isValidDocument(response.document)) {
    const note = trimAssistantNote(response.assistantNote)
    return {
      kind: "document",
      document: response.document as DesignDocument,
      ...(note ? { assistantNote: note } : {}),
    }
  }

  if (response.kind === "patches" && isValidPatches(response.patches)) {
    const note = trimAssistantNote(response.assistantNote)
    return {
      kind: "patches",
      patches: response.patches,
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

  if (isValidDocument(obj)) {
    const rec = obj as Record<string, unknown>
    const note = trimAssistantNote(rec.assistantNote)
    return {
      kind: "document",
      document: obj as DesignDocument,
      ...(note ? { assistantNote: note } : {}),
    }
  }

  return null
}

export function extractJsonFromStream(raw: string): DesignAiResponse {
  const candidates = collectDesignJsonCandidates(raw)
  for (const c of candidates) {
    const parsed = parseJsonLoose(c)
    const result = interpretParsedObject(parsed)
    if (result) return result
  }
  return { kind: "message", text: DESIGN_MODEL_PARSE_FAILED_MESSAGE }
}
