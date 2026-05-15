import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import type { ShapeElement } from "../../types"
import { useDesignStore } from "../../store/design-store"
import { DesignColorPicker } from "./design-color-picker"
import { PATTERN_IDS } from "../../lib/fill-pattern-catalog"

interface Props {
  element: ShapeElement
  pageId: string
}

export function ShapeProperties({ element, pageId }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)
  const update = (patch: Partial<ShapeElement>) =>
    applyPatches([{ op: "update_element", pageId, elementId: element.id, patch }], { clearSelection: false })

  return (
    <div className="flex flex-col gap-3 p-3">
      {element.shape !== "line" && element.shape !== "arrow" ? (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Fill color</Label>
            <DesignColorPicker value={element.fill === "transparent" ? "#ffffff" : element.fill} onChange={(hex) => update({ fill: hex })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Pattern fill</Label>
            <select
              value={element.patternFill?.patternId ?? ""}
              onChange={(e) => {
                const patternId = e.target.value
                if (!patternId) {
                  update({ patternFill: undefined })
                  return
                }
                update({
                  patternFill: {
                    patternId,
                    patternColor: element.patternFill?.patternColor ?? "#94A3B8",
                  },
                })
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
          {element.patternFill ? (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Pattern color</Label>
              <DesignColorPicker
                value={element.patternFill.patternColor}
                onChange={(hex) =>
                  update({ patternFill: { ...element.patternFill!, patternColor: hex } })
                }
              />
            </div>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Stroke color</Label>
        <DesignColorPicker
          value={element.stroke ?? "#000000"}
          onChange={(hex) => update({ stroke: hex })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Stroke width</Label>
          <Input
            type="number"
            value={element.strokeWidth ?? 0}
            min={0}
            max={50}
            onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        {element.shape === "rectangle" ? (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Border radius</Label>
            <Input
              type="number"
              value={element.borderRadius ?? 0}
              min={0}
              max={500}
              onChange={(e) => update({ borderRadius: Number(e.target.value) })}
              className="h-7 text-xs"
            />
          </div>
        ) : element.shape === "polygon" ? (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sides</Label>
            <Input
              type="number"
              value={element.polygonSides ?? 6}
              min={3}
              max={12}
              onChange={(e) => update({ polygonSides: Math.min(12, Math.max(3, Number(e.target.value) || 6)) })}
              className="h-7 text-xs"
            />
          </div>
        ) : element.shape === "star" ? (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Points</Label>
            <Input
              type="number"
              value={element.starPoints ?? 5}
              min={3}
              max={12}
              onChange={(e) => update({ starPoints: Math.min(12, Math.max(3, Number(e.target.value) || 5)) })}
              className="h-7 text-xs"
            />
          </div>
        ) : (
          <div />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Opacity ({Math.round(element.opacity * 100)}%)</Label>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[element.opacity]}
          onValueChange={([v]) => update({ opacity: v })}
        />
      </div>
    </div>
  )
}
