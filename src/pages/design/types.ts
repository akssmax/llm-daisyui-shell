export type ElementBase = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  opacity: number
  locked?: boolean
}

export type TextElement = ElementBase & {
  kind: "text"
  content: string
  fontFamily: string
  fontSize: number
  /** CSS `font-weight`: `"100"`–`"900"`, or legacy `"normal"` / `"bold"`. */
  fontWeight: string
  fontStyle: "normal" | "italic"
  color: string
  textAlign: "left" | "center" | "right"
  lineHeight: number
  backgroundColor?: string
  borderRadius?: number
}

export type ImageElement = ElementBase & {
  kind: "image"
  src: string
  objectFit: "cover" | "contain" | "fill"
  borderRadius?: number
}

/** Shape geometry for `kind: "shape"` — toolbar drawing + AI JSON. */
export type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "line"
  | "arrow"
  | "polygon"
  | "star"

export type PatternFill = {
  patternId: string
  patternColor: string
}

export type ShapeElement = ElementBase & {
  kind: "shape"
  shape: ShapeKind
  fill: string
  stroke?: string
  strokeWidth?: number
  borderRadius?: number
  /** `polygon` only — number of sides (3–12). Default 6. */
  polygonSides?: number
  /** `star` only — number of points (3–12). Default 5. */
  starPoints?: number
  patternFill?: PatternFill
}

export type IconElement = ElementBase & {
  kind: "icon"
  iconName: string
  /** Stroke/fill color for the icon paths. */
  color: string
  /** Stroke width in **screen pixels** (default 2). Does not balloon when the icon is resized. */
  strokeWidth?: number
}

export type SilhouetteElement = ElementBase & {
  kind: "silhouette"
  shapeName: string
  color: string
}

export type DesignElement = TextElement | ImageElement | ShapeElement | IconElement | SilhouetteElement

export type PageBackgroundPattern = {
  patternId: string
  color: string
  backgroundColor?: string
  opacity?: number
}

export type Theme = {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
}

export type DesignPage = {
  id: string
  width: number
  height: number
  backgroundColor: string
  backgroundPattern?: PageBackgroundPattern
  elements: DesignElement[]
}

export type DocumentType =
  | "carousel"
  | "slide"
  | "social-post"
  | "document"
  | "poster"
  | "email"

export type DesignDocument = {
  id: string
  title: string
  type: DocumentType
  createdAt: string
  updatedAt: string
  pages: DesignPage[]
  theme: Theme
}

export type PatchOp =
  | { op: "create_element"; pageId: string; element: DesignElement }
  | { op: "update_element"; pageId: string; elementId: string; patch: Partial<DesignElement> }
  | { op: "delete_element"; pageId: string; elementId: string }
  | { op: "apply_theme"; theme: Partial<Theme> }
  | { op: "create_page"; page: DesignPage }
  | { op: "delete_page"; pageId: string }
  | {
      op: "update_page"
      pageId: string
      patch: Partial<Pick<DesignPage, "backgroundColor" | "backgroundPattern">>
    }
  | { op: "reorder_element"; pageId: string; elementId: string; zIndex: number }

export type DesignAiResponse =
  | { kind: "document"; document: DesignDocument; assistantNote?: string }
  | { kind: "patches"; patches: PatchOp[]; assistantNote?: string }
  | { kind: "message"; text: string; assistantNote?: string }
