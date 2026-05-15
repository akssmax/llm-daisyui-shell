import { useState } from "react"
import { LayoutGrid } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getLayoutById, layoutPatternToLayoutTree } from "../../lib/layout-intelligence/layout-catalog"
import { retrieveLayouts } from "../../lib/layout-intelligence/layout-retrieval"
import { applyLayoutToDocument } from "../../lib/layout-intelligence/apply-layout"
import { useDesignStore } from "../../store/design-store"

function LayoutWireframe({ layoutId, className }: { layoutId: string; className?: string }) {
  const layout = getLayoutById(layoutId)
  if (!layout) return null
  return (
    <svg viewBox="0 0 100 60" className={cn("w-full rounded border bg-muted/30", className)} aria-hidden>
      {layout.regions.map((r) => (
        <rect
          key={r.id}
          x={r.relativeRect.x * 100}
          y={r.relativeRect.y * 60}
          width={r.relativeRect.w * 100}
          height={r.relativeRect.h * 60}
          fill="currentColor"
          className="text-primary/30"
          stroke="currentColor"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}

export function LayoutPickerButton() {
  const [open, setOpen] = useState(false)
  const { document, setDocument, lastLayoutId } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      setDocument: s.setDocument,
      lastLayoutId: s.lastLayoutId,
    })),
  )

  const queryHint =
    document?.type === "carousel"
      ? "linkedin carousel"
      : document?.type === "slide"
        ? "presentation slide"
        : "social post"
  const topLayouts = retrieveLayouts({ userPrompt: queryHint }).top5

  const handlePick = (layoutId: string) => {
    const pattern = getLayoutById(layoutId)
    if (!pattern) return
    const layout = layoutPatternToLayoutTree(pattern)
    if (document) {
      const updated = applyLayoutToDocument(document, layout)
      if (updated) {
        setDocument(updated)
        useDesignStore.setState({ lastLayoutId: layoutId })
      }
    } else {
      useDesignStore.setState({ pendingVariantLayoutIds: [layoutId], lastLayoutId: layoutId })
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-8 gap-1.5 text-xs"
          title="Pick layout"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Layout
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="mb-2 px-1 text-xs text-muted-foreground">
          Recompose using a catalog layout
        </p>
        <div className="grid max-h-64 gap-2 overflow-y-auto">
          {topLayouts.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => handlePick(l.id)}
              className={cn(
                "rounded-md border p-2 text-left transition-colors hover:bg-muted/60",
                lastLayoutId === l.id && "border-primary bg-primary/5",
              )}
            >
              <LayoutWireframe layoutId={l.id} className="h-12" />
              <span className="mt-1 block truncate text-[11px] font-medium">{l.id}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
