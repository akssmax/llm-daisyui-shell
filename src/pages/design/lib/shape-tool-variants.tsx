import type { ReactNode } from "react"
import {
  ArrowUpRight,
  Circle,
  Hexagon,
  ImageIcon,
  Slash,
  Square,
  Star,
  Triangle,
} from "lucide-react"
import type { ShapeKind } from "../types"

export type ShapeToolOption = {
  kind: ShapeKind
  label: string
  shortcut?: string
  icon: ReactNode
}

export const SHAPE_TOOL_OPTIONS: ShapeToolOption[] = [
  { kind: "rectangle", label: "Rectangle", shortcut: "R", icon: <Square className="h-3.5 w-3.5" /> },
  { kind: "line", label: "Line", shortcut: "L", icon: <Slash className="h-3.5 w-3.5" /> },
  { kind: "arrow", label: "Arrow", shortcut: "⇧L", icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
  { kind: "ellipse", label: "Ellipse", shortcut: "O", icon: <Circle className="h-3.5 w-3.5" /> },
  { kind: "triangle", label: "Triangle", icon: <Triangle className="h-3.5 w-3.5" /> },
  { kind: "polygon", label: "Polygon", icon: <Hexagon className="h-3.5 w-3.5" /> },
  { kind: "star", label: "Star", icon: <Star className="h-3.5 w-3.5" /> },
]

export function shapeToolIcon(kind: ShapeKind): ReactNode {
  const row = SHAPE_TOOL_OPTIONS.find((o) => o.kind === kind)
  return row?.icon ?? <Square className="h-3.5 w-3.5" />
}

export function shapeToolLabel(kind: ShapeKind): string {
  const row = SHAPE_TOOL_OPTIONS.find((o) => o.kind === kind)
  return row?.label ?? "Rectangle"
}

/** Row after shapes: open device image picker (toolbar wires `onPickImage`). */
export const SHAPE_MENU_IMAGE_ROW = {
  label: "Image",
  shortcut: "⇧⌘K",
  icon: <ImageIcon className="h-3.5 w-3.5" />,
} as const
