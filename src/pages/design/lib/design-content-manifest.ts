import type { DesignDocument, DesignElement } from "../types"
import { safePageElements } from "./safe-page-elements"

export type ManifestElement = {
  pageIndex: number
  kind: DesignElement["kind"]
  content: string
  color?: string
  iconName?: string
  shapeName?: string
  semanticRole: string
}

export type DesignContentManifest = {
  title: string
  pages: { index: number; width: number; height: number; backgroundColor: string }[]
  elements: ManifestElement[]
}

function inferSemanticRole(el: DesignElement): string {
  if (el.kind === "text") {
    const t = el.content.toLowerCase()
    if (t.includes("invoice") || t.includes("total") || t.includes("subtotal")) return "heading"
    if (t.length < 40) return "label"
    if (t.length > 120) return "body"
    return "text"
  }
  if (el.kind === "icon") return "icon"
  if (el.kind === "silhouette") return "decoration"
  if (el.kind === "image") return "image"
  return "shape"
}

function elementContent(el: DesignElement): string {
  switch (el.kind) {
    case "text":
      return el.content
    case "icon":
      return el.iconName
    case "silhouette":
      return el.shapeName
    case "image":
      return el.src.startsWith("data:") ? "[image]" : el.src
    case "shape":
      return el.shape
    default:
      return ""
  }
}

/** Extract copy and semantics from a document — no x/y/width/height (for layout remix). */
export function extractContentManifest(document: DesignDocument): DesignContentManifest {
  const elements: ManifestElement[] = []

  document.pages.forEach((page, pageIndex) => {
    for (const el of safePageElements(page)) {
      const content = elementContent(el)
      if (!content.trim() && el.kind !== "shape") continue
      elements.push({
        pageIndex,
        kind: el.kind,
        content,
        ...(el.kind === "text" ? { color: el.color } : {}),
        ...(el.kind === "icon" ? { color: el.color, iconName: el.iconName } : {}),
        ...(el.kind === "silhouette" ? { color: el.color, shapeName: el.shapeName } : {}),
        semanticRole: inferSemanticRole(el),
      })
    }
  })

  return {
    title: document.title,
    pages: document.pages.map((p, index) => ({
      index,
      width: p.width,
      height: p.height,
      backgroundColor: p.backgroundColor,
    })),
    elements,
  }
}

export function formatContentManifestForPrompt(manifest: DesignContentManifest): string {
  return JSON.stringify(manifest, null, 0)
}
