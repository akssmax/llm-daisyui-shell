import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import { useDesignStore } from "../../store/design-store"
import { TextProperties } from "./text-properties"
import { ShapeProperties } from "./shape-properties"
import { ImageProperties } from "./image-properties"

/**
 * Floating properties card over the canvas (not in the resizable split).
 * Shown only when exactly one element is selected. Only the card intercepts pointer events so the canvas stays usable elsewhere.
 */
export function FloatingDesignProperties() {
  const { document, activePageId, selection } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      activePageId: s.activePageId,
      selection: s.selection,
    })),
  )

  const hasOne = selection.elementIds.length === 1
  const pageId = selection.pageId ?? activePageId ?? ""
  const page = document?.pages.find((p) => p.id === pageId) ?? document?.pages[0]
  const element = hasOne ? page?.elements.find((el) => el.id === selection.elementIds[0]) : undefined

  if (!element || !page) return null

  return (
    <div
      className={cn(
        "absolute top-3 right-3 bottom-3 z-30 flex flex-col overflow-hidden",
        "w-[min(22.5rem,calc(100%-1.5rem))] min-w-[17.5rem]",
        "rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-md",
        "ring-1 ring-black/5 supports-backdrop-filter:bg-background/85 dark:ring-white/10",
      )}
    >
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-sm font-medium capitalize text-foreground">{element.kind} properties</p>
      </div>
      <div className="relative min-h-0 flex-1 overflow-x-hidden">
        <div
          key={element.id}
          className="h-full min-h-0 overflow-y-auto duration-300 ease-out animate-in fade-in-0 slide-in-from-right-4 fill-mode-both motion-reduce:animate-none motion-reduce:translate-x-0 motion-reduce:opacity-100"
        >
          {element.kind === "text" && <TextProperties element={element} pageId={page.id} />}
          {element.kind === "shape" && <ShapeProperties element={element} pageId={page.id} />}
          {element.kind === "image" && <ImageProperties element={element} pageId={page.id} />}
          {element.kind === "icon" && (
            <div className="p-3 text-xs text-muted-foreground">Icon: {element.iconName}</div>
          )}
        </div>
      </div>
    </div>
  )
}
