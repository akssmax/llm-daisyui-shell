import { useRef, type ReactElement, type ReactNode } from "react"
import {
  ChevronDown,
  Hand,
  ImageIcon,
  MousePointer2,
  Sparkles,
  Type,
  Undo2,
  Redo2,
} from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useDesignStore, type ActiveTool } from "../../store/design-store"
import {
  SHAPE_MENU_IMAGE_ROW,
  SHAPE_TOOL_OPTIONS,
  shapeToolIcon,
  shapeToolLabel,
} from "../../lib/shape-tool-variants.tsx"
import { AGENT_AVATAR_SHAPES } from "../../lib/agent-silhouette-registry"
import { PresetPicker } from "./preset-picker"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Shadcn tooltip on icon controls; wraps disabled buttons so hover still shows the tooltip. */
function ToolbarTooltip({
  label,
  disabled,
  children,
}: {
  label: string
  disabled?: boolean
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? (
          <span className="inline-flex rounded-md" tabIndex={0}>
            {children}
          </span>
        ) : (
          children
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function DesignToolbar() {
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    past,
    future,
    undo,
    redo,
    document,
    activeTool,
    setActiveTool,
    shapeToolVariant,
    setShapeToolVariant,
    silhouetteToolShape,
    setSilhouetteToolShape,
    setPendingDesignImage,
  } = useDesignStore(
    useShallow((s) => ({
      past: s.past,
      future: s.future,
      undo: s.undo,
      redo: s.redo,
      document: s.document,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      shapeToolVariant: s.shapeToolVariant,
      setShapeToolVariant: s.setShapeToolVariant,
      silhouetteToolShape: s.silhouetteToolShape,
      setSilhouetteToolShape: s.setSilhouetteToolShape,
      setPendingDesignImage: s.setPendingDesignImage,
    })),
  )

  function toolBtn(tool: ActiveTool, label: string, icon: ReactNode) {
    const on = activeTool === tool
    return (
      <ToolbarTooltip label={label}>
        <Button
          type="button"
          variant={on ? "secondary" : "ghost"}
          size="icon"
          className={cn("h-7 w-7", on && "ring-1 ring-primary/40")}
          aria-label={label}
          onClick={() => setActiveTool(tool)}
        >
          {icon}
        </Button>
      </ToolbarTooltip>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          if (f.size > MAX_IMAGE_BYTES) {
            toast.error("Image must be 5 MB or smaller.")
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const url = reader.result
            if (typeof url === "string") {
              setActiveTool("image")
              setPendingDesignImage(url)
            }
          }
          reader.readAsDataURL(f)
        }}
      />

      <PresetPicker />

      {document && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarTooltip label="Undo (⌘Z)" disabled={past.length === 0}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Undo"
              onClick={undo}
              disabled={past.length === 0}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Redo (⌘⇧Z)" disabled={future.length === 0}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Redo"
              onClick={redo}
              disabled={future.length === 0}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </ToolbarTooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {toolBtn("select", "Select / move (V)", <MousePointer2 className="h-3.5 w-3.5" />)}
          {toolBtn("hand", "Hand (Space, H)", <Hand className="h-3.5 w-3.5" />)}

          <div
            className={cn(
              "flex h-7 overflow-hidden rounded-lg border border-transparent",
              activeTool === "shape" && "border-primary/40 ring-1 ring-primary/40",
            )}
          >
            <ToolbarTooltip label={`${shapeToolLabel(shapeToolVariant)} — draw on canvas (R)`}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-none rounded-l-lg"
                aria-label={`${shapeToolLabel(shapeToolVariant)} tool`}
                onClick={() => setActiveTool("shape")}
              >
                {shapeToolIcon(shapeToolVariant)}
              </Button>
            </ToolbarTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-6 shrink-0 rounded-none rounded-r-lg border-l border-border/80 px-0"
                  aria-label="More shapes"
                >
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[13rem]">
                {SHAPE_TOOL_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.kind}
                    className="gap-2"
                    onClick={() => {
                      setShapeToolVariant(opt.kind)
                      setActiveTool("shape")
                    }}
                  >
                    <span className="flex w-4 justify-center text-muted-foreground">
                      {shapeToolVariant === opt.kind ? "✓" : ""}
                    </span>
                    <span className="text-muted-foreground">{opt.icon}</span>
                    <span className="flex-1">{opt.label}</span>
                    {opt.shortcut ? (
                      <span className="text-muted-foreground text-xs tabular-nums">{opt.shortcut}</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    setActiveTool("image")
                    fileRef.current?.click()
                  }}
                >
                  <span className="w-4" />
                  <span className="text-muted-foreground">{SHAPE_MENU_IMAGE_ROW.icon}</span>
                  <span className="flex-1">{SHAPE_MENU_IMAGE_ROW.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{SHAPE_MENU_IMAGE_ROW.shortcut}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {toolBtn("text", "Text (T)", <Type className="h-3.5 w-3.5" />)}
          <ToolbarTooltip label="Image — upload from device">
            <Button
              type="button"
              variant={activeTool === "image" ? "secondary" : "ghost"}
              size="icon"
              className={cn("h-7 w-7", activeTool === "image" && "ring-1 ring-primary/40")}
              aria-label="Image — upload from device"
              onClick={() => {
                setActiveTool("image")
                fileRef.current?.click()
              }}
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          </ToolbarTooltip>
          {toolBtn("icon", "Icon (Lucide)", <Sparkles className="h-3.5 w-3.5" />)}
          <div
            className={cn(
              "flex h-7 overflow-hidden rounded-lg border border-transparent",
              activeTool === "silhouette" && "border-primary/40 ring-1 ring-primary/40",
            )}
          >
            <ToolbarTooltip label={`Agent shape: ${silhouetteToolShape}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-none rounded-l-lg"
                aria-label="Agent silhouette"
                onClick={() => setActiveTool("silhouette")}
              >
                <span className="text-[10px] font-bold">◇</span>
              </Button>
            </ToolbarTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-6 shrink-0 rounded-none rounded-r-lg border-l border-border/80 px-0"
                  aria-label="More agent shapes"
                >
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 min-w-[10rem] overflow-y-auto">
                {AGENT_AVATAR_SHAPES.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    className="gap-2"
                    onClick={() => {
                      setSilhouetteToolShape(name)
                      setActiveTool("silhouette")
                    }}
                  >
                    <span className="w-4">{silhouetteToolShape === name ? "✓" : ""}</span>
                    <span>{name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  )
}
