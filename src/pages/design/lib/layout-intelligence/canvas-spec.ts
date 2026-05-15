import type { IntentPlanPayload } from "../design-agent-schemas"
import type { DocumentType } from "../../types"
import { PRESET_SIZES, type PresetKey } from "../design-presets"

export type CanvasFormatId =
  | "linkedin-post"
  | "linkedin-carousel"
  | "instagram-post"
  | "instagram-story"
  | "presentation"
  | "a4-portrait"
  | "a4-landscape"
  | "us-letter-portrait"
  | "us-letter-landscape"
  | "resume"
  | "cover-letter"
  | "email-header"
  | "email-newsletter"
  | "website-hero"
  | "poster-a3"
  | "business-card"
  | "invoice"
  | "receipt"
  | "twitter-post"
  | "youtube-thumbnail"
  | "custom"

export type CanvasSpec = {
  width: number
  height: number
  format: CanvasFormatId
  documentType: DocumentType
  label: string
}

function snap8(n: number): number {
  return Math.round(n / 8) * 8
}

/** Screen-design pixel sizes (readable on canvas, export-friendly). */
export const CANVAS_FORMATS: Record<CanvasFormatId, CanvasSpec> = {
  "linkedin-post": {
    width: 1080,
    height: 1350,
    format: "linkedin-post",
    documentType: "social-post",
    label: "LinkedIn Post",
  },
  "linkedin-carousel": {
    width: 1080,
    height: 1350,
    format: "linkedin-carousel",
    documentType: "carousel",
    label: "LinkedIn Carousel",
  },
  "instagram-post": {
    width: 1080,
    height: 1080,
    format: "instagram-post",
    documentType: "social-post",
    label: "Instagram Post",
  },
  "instagram-story": {
    width: 1080,
    height: 1920,
    format: "instagram-story",
    documentType: "social-post",
    label: "Instagram Story",
  },
  presentation: {
    width: 1920,
    height: 1080,
    format: "presentation",
    documentType: "slide",
    label: "Presentation Slide",
  },
  "a4-portrait": {
    width: 794,
    height: 1123,
    format: "a4-portrait",
    documentType: "document",
    label: "A4 Portrait",
  },
  "a4-landscape": {
    width: 1123,
    height: 794,
    format: "a4-landscape",
    documentType: "document",
    label: "A4 Landscape",
  },
  "us-letter-portrait": {
    width: 816,
    height: 1056,
    format: "us-letter-portrait",
    documentType: "document",
    label: "US Letter Portrait",
  },
  "us-letter-landscape": {
    width: 1056,
    height: 816,
    format: "us-letter-landscape",
    documentType: "document",
    label: "US Letter Landscape",
  },
  resume: {
    width: 794,
    height: 1123,
    format: "resume",
    documentType: "document",
    label: "Resume (A4)",
  },
  "cover-letter": {
    width: 816,
    height: 1056,
    format: "cover-letter",
    documentType: "document",
    label: "Cover Letter",
  },
  "email-header": {
    width: 1200,
    height: 400,
    format: "email-header",
    documentType: "email",
    label: "Email Header",
  },
  "email-newsletter": {
    width: 600,
    height: 1200,
    format: "email-newsletter",
    documentType: "email",
    label: "Email Newsletter",
  },
  "website-hero": {
    width: 1440,
    height: 900,
    format: "website-hero",
    documentType: "document",
    label: "Website Hero",
  },
  "poster-a3": {
    width: 1123,
    height: 1587,
    format: "poster-a3",
    documentType: "poster",
    label: "Poster (A3)",
  },
  "business-card": {
    width: 1050,
    height: 600,
    format: "business-card",
    documentType: "document",
    label: "Business Card",
  },
  invoice: {
    width: 794,
    height: 1123,
    format: "invoice",
    documentType: "document",
    label: "Invoice (A4)",
  },
  receipt: {
    width: 400,
    height: 720,
    format: "receipt",
    documentType: "document",
    label: "Receipt",
  },
  "twitter-post": {
    width: 1200,
    height: 675,
    format: "twitter-post",
    documentType: "social-post",
    label: "Twitter / X Post",
  },
  "youtube-thumbnail": {
    width: 1280,
    height: 720,
    format: "youtube-thumbnail",
    documentType: "social-post",
    label: "YouTube Thumbnail",
  },
  custom: {
    width: 1080,
    height: 1080,
    format: "custom",
    documentType: "document",
    label: "Custom",
  },
}

export function canvasFormatsForPrompt(): string {
  return Object.values(CANVAS_FORMATS)
    .filter((f) => f.format !== "custom")
    .map((f) => `${f.format}: ${f.width}×${f.height} (${f.label}, type:${f.documentType})`)
    .join("\n")
}

function clampDim(n: number, min = 320, max = 4096): number {
  return snap8(Math.max(min, Math.min(max, Math.round(n))))
}

export function normalizeCanvasSpec(raw: {
  width?: number
  height?: number
  format?: string
  documentType?: string
}): CanvasSpec | null {
  const formatKey = typeof raw.format === "string" ? raw.format.trim().toLowerCase() : ""
  const catalog = CANVAS_FORMATS[formatKey as CanvasFormatId]
  if (catalog) {
    return { ...catalog }
  }

  const w = typeof raw.width === "number" ? clampDim(raw.width) : null
  const h = typeof raw.height === "number" ? clampDim(raw.height) : null
  if (!w || !h) return null

  const docType = asDocumentType(raw.documentType)
  return {
    width: w,
    height: h,
    format: "custom",
    documentType: docType,
    label: `${w}×${h}`,
  }
}

function asDocumentType(v: unknown): DocumentType {
  const s = typeof v === "string" ? v.toLowerCase() : ""
  if (s === "carousel") return "carousel"
  if (s === "slide" || s === "presentation") return "slide"
  if (s === "email") return "email"
  if (s === "poster") return "poster"
  if (s === "social-post" || s === "social") return "social-post"
  return "document"
}

/** Heuristic canvas pick from user message (used before / without LLM canvas). */
export function inferCanvasFromMessage(userMessage: string): CanvasSpec {
  const blob = userMessage.toLowerCase()

  if (blob.includes("cover letter")) return CANVAS_FORMATS["cover-letter"]
  if (blob.includes("receipt") || blob.includes("thermal print")) return CANVAS_FORMATS.receipt
  if (blob.includes("invoice") || blob.includes("billing statement") || blob.includes("bill to")) {
    return CANVAS_FORMATS.invoice
  }
  if (blob.includes("quote") && (blob.includes("client") || blob.includes("total"))) {
    return CANVAS_FORMATS.invoice
  }
  if (blob.includes("resume") || blob.includes("résumé") || blob.includes("cv")) {
    return CANVAS_FORMATS.resume
  }
  if (blob.includes("a4") && blob.includes("landscape")) return CANVAS_FORMATS["a4-landscape"]
  if (blob.includes("a4")) return CANVAS_FORMATS["a4-portrait"]
  if (blob.includes("letter size") || blob.includes("us letter")) {
    return blob.includes("landscape")
      ? CANVAS_FORMATS["us-letter-landscape"]
      : CANVAS_FORMATS["us-letter-portrait"]
  }
  if (blob.includes("business card")) return CANVAS_FORMATS["business-card"]
  if (blob.includes("email newsletter") || blob.includes("newsletter")) {
    return CANVAS_FORMATS["email-newsletter"]
  }
  if (blob.includes("email") || blob.includes("mailchimp")) return CANVAS_FORMATS["email-header"]
  if (blob.includes("youtube") || blob.includes("thumbnail")) return CANVAS_FORMATS["youtube-thumbnail"]
  if (blob.includes("twitter") || blob.includes(" x post")) return CANVAS_FORMATS["twitter-post"]
  if (blob.includes("instagram story")) return CANVAS_FORMATS["instagram-story"]
  if (blob.includes("instagram")) return CANVAS_FORMATS["instagram-post"]
  if (
    blob.includes("linkedin") &&
    (/\b(1\s*:\s*1|1:1|square)\b/.test(blob) || blob.includes("canvas size"))
  ) {
    return {
      ...CANVAS_FORMATS["instagram-post"],
      format: "linkedin-post",
      documentType: "social-post",
      label: "LinkedIn Square (1:1)",
    }
  }
  if (blob.includes("linkedin") && blob.includes("carousel")) return CANVAS_FORMATS["linkedin-carousel"]
  if (blob.includes("linkedin")) return CANVAS_FORMATS["linkedin-post"]
  if (blob.includes("presentation") || blob.includes("pitch deck") || blob.includes("slide deck")) {
    return CANVAS_FORMATS.presentation
  }
  if (blob.includes("poster")) return CANVAS_FORMATS["poster-a3"]
  if (blob.includes("website") || blob.includes("landing page") || blob.includes("hero")) {
    return CANVAS_FORMATS["website-hero"]
  }
  if (blob.includes("carousel")) return CANVAS_FORMATS["linkedin-carousel"]

  return CANVAS_FORMATS["instagram-post"]
}

export function canvasFromPresetKey(key: PresetKey): CanvasSpec {
  const p = PRESET_SIZES[key]
  return {
    width: p.width,
    height: p.height,
    format: key as CanvasFormatId,
    documentType: p.type,
    label: p.label,
  }
}

export type ResolveCanvasOptions = {
  userMessage: string
  intent?: IntentPlanPayload | null
  presetKey?: PresetKey | "auto" | null
}

/** Resolve final canvas dimensions for the pipeline. */
export function resolveCanvasSpec(opts: ResolveCanvasOptions): CanvasSpec {
  const { userMessage, intent, presetKey } = opts

  if (presetKey && presetKey !== "auto") {
    return canvasFromPresetKey(presetKey)
  }

  const planCanvas = intent?.plan?.canvas
  if (planCanvas) {
    const normalized = normalizeCanvasSpec(planCanvas)
    if (normalized) return normalized
  }

  return inferCanvasFromMessage(userMessage)
}

export function inferDocumentTypeFromMessage(
  userMessage: string,
  intent?: IntentPlanPayload | null,
): DocumentType {
  if (intent?.plan?.canvas?.documentType) {
    return asDocumentType(intent.plan.canvas.documentType)
  }
  return resolveCanvasSpec({ userMessage, intent, presetKey: "auto" }).documentType
}

export function documentMatchesCanvasSpec(
  doc: import("../../types").DesignDocument,
  spec: CanvasSpec,
): boolean {
  if (doc.pages.length === 0) return false
  return doc.pages.every((p) => p.width === spec.width && p.height === spec.height)
}

/** User explicitly asked to change artboard / canvas dimensions. */
export function userRequestsCanvasResize(userMessage: string): boolean {
  const blob = userMessage.toLowerCase()
  return (
    /\b(canvas\s+size|artboard\s+size|frame\s+size|page\s+size|resize\s+(?:the\s+)?(?:canvas|artboard|frame|pages?))\b/.test(
      blob,
    ) ||
    /\b(use|set|switch\s+to|change\s+to)\s+(?:that\s+)?(?:canvas|artboard)\s+size\b/.test(blob) ||
    /\b(1\s*:\s*1|1:1|square\s+canvas|square\s+format)\b/.test(blob) ||
    /\b\d{3,4}\s*[x×]\s*\d{3,4}\b/.test(blob)
  )
}

/** Whether the agent should resize all pages to the resolved canvas spec after compose. */
export function shouldApplyCanvasSpecToDocument(
  doc: import("../../types").DesignDocument | null,
  spec: CanvasSpec,
  userMessage: string,
  intent?: IntentPlanPayload | null,
): boolean {
  if (!doc || doc.pages.length === 0) return true
  if (documentMatchesCanvasSpec(doc, spec)) return false
  if (userRequestsCanvasResize(userMessage)) return true
  if (intent?.plan?.canvas) {
    const mentionsFormat =
      /\b(canvas|artboard|frame|size|dimension|linkedin|instagram|twitter|presentation|a4|format|aspect)\b/i.test(
        userMessage,
      )
    if (mentionsFormat) return true
  }
  return false
}

/** Resize every page on the document to the resolved artboard size. */
export function applyCanvasSpecToDocument(
  doc: import("../../types").DesignDocument,
  spec: CanvasSpec,
): import("../../types").DesignDocument {
  return {
    ...doc,
    type: spec.documentType,
    pages: doc.pages.map((p) => ({
      ...p,
      width: spec.width,
      height: spec.height,
    })),
    updatedAt: new Date().toISOString(),
  }
}
