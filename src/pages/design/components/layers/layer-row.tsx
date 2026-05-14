import { Type, Image, Star, ChevronUp, ChevronDown, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DesignElement } from "../../types"
import { shapeToolIcon, shapeToolLabel } from "../../lib/shape-tool-variants"
import { cn } from "@/lib/utils"

interface Props {
  element: DesignElement
  isSelected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const kindIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: Image,
  icon: Star,
}

function elementLabel(el: DesignElement): string {
  if (el.kind === "text") return (typeof el.content === "string" ? el.content : "").slice(0, 20) || "Text"
  if (el.kind === "image") return "Image"
  if (el.kind === "shape") return shapeToolLabel(el.shape ?? "rectangle")
  if (el.kind === "icon") return typeof el.iconName === "string" ? el.iconName : "Icon"
  return typeof el.kind === "string" && el.kind ? el.kind : "Element"
}

export function LayerRow({ element, isSelected, isFirst, isLast, onSelect, onMoveUp, onMoveDown }: Props) {
  const label = elementLabel(element)

  let rowIcon: React.ReactNode
  if (element.kind === "shape") {
    rowIcon = (
      <span className="inline-flex shrink-0 opacity-60 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0">
        {shapeToolIcon(element.shape)}
      </span>
    )
  } else {
    const Icon = kindIconMap[element.kind] ?? Type
    rowIcon = <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
    >
      {rowIcon}
      <span className="flex-1 truncate">{label || element.kind}</span>
      {element.locked && <Lock className="h-3 w-3 opacity-40" />}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => { e.stopPropagation(); onMoveUp() }}
          disabled={isFirst}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => { e.stopPropagation(); onMoveDown() }}
          disabled={isLast}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
