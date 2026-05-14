import { useShallow } from "zustand/react/shallow"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DesignColorPicker } from "../properties/design-color-picker"
import { useDesignStore } from "../../store/design-store"

/** Minimal contextual controls when a text layer is selected (complements the properties sheet). */
export function DesignTextQuickStrip() {
  const { document, selection, applyPatches } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      selection: s.selection,
      applyPatches: s.applyPatches,
    })),
  )

  if (!document || selection.elementIds.length !== 1 || !selection.pageId) return null
  const page = document.pages.find((p) => p.id === selection.pageId)
  const el = page?.elements.find((e) => e.id === selection.elementIds[0])
  if (!el || el.kind !== "text" || !page) return null

  return (
    <div className="flex max-w-[min(100%,480px)] flex-wrap items-center gap-2 rounded-md border border-border/80 bg-muted/30 px-2 py-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Size</Label>
        <Input
          className="h-7 w-14 px-1 text-xs"
          type="number"
          min={8}
          max={400}
          value={el.fontSize}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isFinite(n)) return
            applyPatches(
              [{ op: "update_element", pageId: page.id, elementId: el.id, patch: { fontSize: n } }],
              { clearSelection: false },
            )
          }}
        />
      </div>
      <div className="flex min-w-[min(100%,12rem)] flex-1 items-center gap-1.5">
        <Label className="shrink-0 text-xs text-muted-foreground">Color</Label>
        <div className="min-w-0 flex-1">
          <DesignColorPicker
            value={el.color}
            onChange={(hex) =>
              applyPatches(
                [{ op: "update_element", pageId: page.id, elementId: el.id, patch: { color: hex } }],
                { clearSelection: false },
              )
            }
          />
        </div>
      </div>
    </div>
  )
}
