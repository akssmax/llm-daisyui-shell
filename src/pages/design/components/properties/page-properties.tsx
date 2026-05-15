import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type { DesignPage } from "../../types"
import { useDesignStore } from "../../store/design-store"
import { DesignColorPicker } from "./design-color-picker"
import { PATTERN_IDS } from "../../lib/fill-pattern-catalog"

interface Props {
  page: DesignPage
}

export function PageProperties({ page }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)
  const bp = page.backgroundPattern

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Frame fill</Label>
        <DesignColorPicker
          value={page.backgroundColor}
          onChange={(hex) =>
            applyPatches([{ op: "update_page", pageId: page.id, patch: { backgroundColor: hex } }])
          }
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Background pattern</Label>
        <select
          value={bp?.patternId ?? ""}
          onChange={(e) => {
            const patternId = e.target.value
            if (!patternId) {
              applyPatches([
                { op: "update_page", pageId: page.id, patch: { backgroundPattern: undefined } },
              ])
              return
            }
            applyPatches([
              {
                op: "update_page",
                pageId: page.id,
                patch: {
                  backgroundPattern: {
                    patternId,
                    color: bp?.color ?? "#94A3B8",
                    backgroundColor: page.backgroundColor,
                  },
                },
              },
            ])
          }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">None</option>
          {PATTERN_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      {bp ? (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Pattern color</Label>
            <DesignColorPicker
              value={bp.color}
              onChange={(hex) =>
                applyPatches([
                  {
                    op: "update_page",
                    pageId: page.id,
                    patch: {
                      backgroundPattern: { ...bp, color: hex, backgroundColor: page.backgroundColor },
                    },
                  },
                ])
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">
              Pattern opacity ({Math.round((bp.opacity ?? 1) * 100)}%)
            </Label>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[bp.opacity ?? 1]}
              onValueChange={([v]) =>
                applyPatches([
                  {
                    op: "update_page",
                    pageId: page.id,
                    patch: {
                      backgroundPattern: {
                        ...bp,
                        opacity: v,
                        backgroundColor: page.backgroundColor,
                      },
                    },
                  },
                ])
              }
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
