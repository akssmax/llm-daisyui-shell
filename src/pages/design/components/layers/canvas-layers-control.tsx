import { useMemo, useState } from "react"
import { Layers, X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useDesignStore } from "../../store/design-store"
import { safePageElements } from "../../lib/safe-page-elements"
import { LayersPanel } from "./layers-panel"

export function CanvasLayersControl() {
  const [open, setOpen] = useState(false)
  const { document, activePageId } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      activePageId: s.activePageId,
    })),
  )

  const layerCount = useMemo(() => {
    const page = document?.pages.find((p) => p.id === activePageId) ?? document?.pages[0]
    if (!page) return 0
    return safePageElements(page).length
  }, [document, activePageId])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          aria-label={`Layers (${layerCount})`}
          disabled={!document}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="tabular-nums text-xs">{layerCount}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className={cn(
          "w-[min(20rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0",
          "rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-md",
          "ring-1 ring-black/5 supports-backdrop-filter:bg-background/85 dark:ring-white/10",
        )}
      >
        <div className="flex max-h-[min(60vh,28rem)] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Layers ({layerCount})
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Close layers"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LayersPanel />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
