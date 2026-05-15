import { Copy, Lock, Trash2, Unlock } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { useDesignStore } from "../../store/design-store"

/** Selection actions when a single element is selected (no canvas Ask-AI per plan). */
export function DesignSelectionBar() {
  const { selection, document, duplicateSelectedElements, toggleSelectedElementLock, deleteSelectedElements } =
    useDesignStore(
      useShallow((s) => ({
        selection: s.selection,
        document: s.document,
        duplicateSelectedElements: s.duplicateSelectedElements,
        toggleSelectedElementLock: s.toggleSelectedElementLock,
        deleteSelectedElements: s.deleteSelectedElements,
      })),
    )

  if (!document || selection.elementIds.length !== 1 || !selection.pageId) return null

  const page = document.pages.find((p) => p.id === selection.pageId)
  const el = page?.elements.find((e) => e.id === selection.elementIds[0])
  if (!el) return null

  return (
    <div className="pointer-events-auto absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-card/95 px-1 py-0.5 shadow-md backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Duplicate (⌘D)"
        onClick={() => duplicateSelectedElements()}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={el.locked ? "Unlock" : "Lock"}
        onClick={() => toggleSelectedElementLock()}
      >
        {el.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        title="Delete (Del)"
        onClick={() => deleteSelectedElements()}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
