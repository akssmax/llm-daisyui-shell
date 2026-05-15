import { nanoid } from "nanoid"
import type { DesignDocument, DesignPage, DocumentType, Theme } from "../types"

export const PRESET_SIZES = {
  "linkedin-post": { width: 1080, height: 1350, label: "LinkedIn Post", type: "social-post" as DocumentType },
  "linkedin-carousel": { width: 1080, height: 1350, label: "LinkedIn Carousel", type: "carousel" as DocumentType },
  "instagram-post": { width: 1080, height: 1080, label: "Instagram Post", type: "social-post" as DocumentType },
  presentation: { width: 1920, height: 1080, label: "Presentation Slide", type: "slide" as DocumentType },
} as const

export type PresetKey = keyof typeof PRESET_SIZES

/** User chose dynamic sizing — intent phase picks format from the prompt. */
export type CanvasPresetMode = PresetKey | "auto"

/** Fallback only — real dimensions come from the agent `canvas-spec` pipeline when mode is `"auto"`. */
export const AI_AUTO_PRESET = {
  width: 1080,
  height: 1080,
  label: "Let AI decide",
  type: "document" as DocumentType,
} as const

export const DEFAULT_THEME: Theme = {
  primaryColor: "#6366f1",
  secondaryColor: "#8b5cf6",
  accentColor: "#06b6d4",
  backgroundColor: "#ffffff",
  fontFamily: "Inter, sans-serif",
}

export function createBlankPage(width: number, height: number, bgColor = "#ffffff"): DesignPage {
  return {
    id: nanoid(8),
    width,
    height,
    backgroundColor: bgColor,
    elements: [],
  }
}

export function createBlankDocument(
  preset: CanvasPresetMode,
  title = "Untitled Design",
): DesignDocument {
  const { width, height, type } =
    preset === "auto" ? AI_AUTO_PRESET : PRESET_SIZES[preset]
  const now = new Date().toISOString()
  return {
    id: nanoid(8),
    title,
    type,
    createdAt: now,
    updatedAt: now,
    theme: { ...DEFAULT_THEME },
    pages: [createBlankPage(width, height)],
  }
}
