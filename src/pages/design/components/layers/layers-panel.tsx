import { useMemo } from "react"
import { Layers } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { useDesignStore } from "../../store/design-store"
import { safePageElements } from "../../lib/safe-page-elements"
import { LayerRow } from "./layer-row"
import { DesignColorPicker } from "../properties/design-color-picker"

export function LayersPanel() {
  const { document, activePageId, selection, selectElements, applyPatches, setActiveTool } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      activePageId: s.activePageId,
      selection: s.selection,
      selectElements: s.selectElements,
      applyPatches: s.applyPatches,
      setActiveTool: s.setActiveTool,
    })),
  )

  const page = document?.pages.find((p) => p.id === activePageId) ?? document?.pages[0]

  const sorted = useMemo(() => {
    if (!page) return []
    return [...safePageElements(page)].sort((a, b) => b.zIndex - a.zIndex)
  }, [page])

  if (!page) return null
  const pageId = page.id

  function moveUp(idx: number) {
    const el = sorted[idx]
    const above = sorted[idx - 1]
    if (!above) return
    applyPatches(
      [
        { op: "reorder_element", pageId, elementId: el.id, zIndex: above.zIndex },
        { op: "reorder_element", pageId, elementId: above.id, zIndex: el.zIndex },
      ],
      { clearSelection: false },
    )
  }

  function moveDown(idx: number) {
    const el = sorted[idx]
    const below = sorted[idx + 1]
    if (!below) return
    applyPatches(
      [
        { op: "reorder_element", pageId, elementId: el.id, zIndex: below.zIndex },
        { op: "reorder_element", pageId, elementId: below.id, zIndex: el.zIndex },
      ],
      { clearSelection: false },
    )
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
        <Layers className="h-3 w-3" />
        Layers ({sorted.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 border-b border-border/60 px-2 pb-2 pt-1">
          <div className="flex items-center gap-2 px-0.5">
            <Label className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Frame
            </Label>
            <div className="min-w-0 flex-1">
              <DesignColorPicker
                value={page.backgroundColor}
                onChange={(hex) =>
                  applyPatches([{ op: "update_page", pageId, patch: { backgroundColor: hex } }], {
                    clearSelection: false,
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {sorted.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No elements yet</p>
          ) : (
            sorted.map((el, idx) => (
              <LayerRow
                key={el.id}
                element={el}
                isSelected={selection.elementIds.includes(el.id)}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                onSelect={() => {
                  setActiveTool("select")
                  selectElements([el.id], pageId)
                }}
                onMoveUp={() => moveUp(idx)}
                onMoveDown={() => moveDown(idx)}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
