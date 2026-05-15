import { X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useDesignStore } from "../../store/design-store"
import { TextProperties } from "./text-properties"
import { ShapeProperties } from "./shape-properties"
import { ImageProperties } from "./image-properties"
import { IconProperties } from "./icon-properties"
import { SilhouetteProperties } from "./silhouette-properties"
import { PageProperties } from "./page-properties"

/**
 * Floating properties card over the canvas. Closed by default; opens when a layer
 * is selected or when the user opens page properties from the layers panel.
 */
export function FloatingDesignProperties() {
  const {
    document,
    activePageId,
    selection,
    propertiesPanelOpen,
    propertiesPanelTarget,
    closePropertiesPanel,
  } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      activePageId: s.activePageId,
      selection: s.selection,
      propertiesPanelOpen: s.propertiesPanelOpen,
      propertiesPanelTarget: s.propertiesPanelTarget,
      closePropertiesPanel: s.closePropertiesPanel,
    })),
  )

  if (!propertiesPanelOpen || !document) return null

  const pageId = selection.pageId ?? activePageId ?? ""
  const page = document.pages.find((p) => p.id === pageId) ?? document.pages[0]
  if (!page) return null

  const hasOne = selection.elementIds.length === 1
  const element =
    propertiesPanelTarget === "element" && hasOne
      ? page.elements.find((el) => el.id === selection.elementIds[0])
      : undefined

  const showPageProperties = propertiesPanelTarget === "page" || !element

  const panelClass = cn(
    "absolute top-3 right-3 bottom-3 z-30 flex flex-col overflow-hidden",
    "w-[min(22.5rem,calc(100%-1.5rem))] min-w-[17.5rem]",
    "rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-md",
    "ring-1 ring-black/5 supports-backdrop-filter:bg-background/85 dark:ring-white/10",
  )

  const headerTitle = showPageProperties
    ? "Page properties"
    : `${element!.kind} properties`

  return (
    <div className={panelClass}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-medium capitalize text-foreground">{headerTitle}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Close properties"
          onClick={closePropertiesPanel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {showPageProperties ? (
          <PageProperties page={page} />
        ) : (
          <div
            key={element!.id}
            className="h-full min-h-0 overflow-y-auto duration-300 ease-out animate-in fade-in-0 slide-in-from-right-4 fill-mode-both motion-reduce:animate-none motion-reduce:translate-x-0 motion-reduce:opacity-100"
          >
            {element!.kind === "text" && <TextProperties element={element} pageId={page.id} />}
            {element!.kind === "shape" && <ShapeProperties element={element} pageId={page.id} />}
            {element!.kind === "image" && <ImageProperties element={element} pageId={page.id} />}
            {element!.kind === "icon" && <IconProperties element={element} pageId={page.id} />}
            {element!.kind === "silhouette" && (
              <SilhouetteProperties element={element} pageId={page.id} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
