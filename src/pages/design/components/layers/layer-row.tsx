import { Type, Image, Square, Star, ChevronUp, ChevronDown, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DesignElement } from "../../types"
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

const kindIcon = {
  text: Type,
  image: Image,
  shape: Square,
  icon: Star,
}

const kindLabel = {
  text: (el: DesignElement) => (el.kind === "text" ? el.content.slice(0, 20) || "Text" : ""),
  image: () => "Image",
  shape: (el: DesignElement) => (el.kind === "shape" ? el.shape : "Shape"),
  icon: (el: DesignElement) => (el.kind === "icon" ? el.iconName : "Icon"),
}

export function LayerRow({ element, isSelected, isFirst, isLast, onSelect, onMoveUp, onMoveDown }: Props) {
  const Icon = kindIcon[element.kind]
  const label = kindLabel[element.kind](element)

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
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
