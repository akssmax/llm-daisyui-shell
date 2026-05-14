import { useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { TextElement } from "../../types"
import { useDesignStore } from "../../store/design-store"
import { DesignColorPicker } from "./design-color-picker"
import { DesignFontTypographyFields } from "./design-font-typography-fields"
import { DesignFontFamilyControl } from "./design-font-family-control"

interface Props {
  element: TextElement
  pageId: string
}

export function TextProperties({ element, pageId }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)

  const update = useCallback(
    (patch: Partial<TextElement>) => {
      applyPatches([{ op: "update_element", pageId, elementId: element.id, patch }], { clearSelection: false })
    },
    [applyPatches, pageId, element.id],
  )

  return (
    <div className="flex flex-col gap-3 p-3">
      <DesignFontFamilyControl
        key={element.id}
        fontFamily={element.fontFamily}
        onCommitStack={(stack) => update({ fontFamily: stack })}
      />
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Font size</Label>
          <Input
            type="number"
            value={element.fontSize}
            min={8}
            max={400}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <DesignFontTypographyFields
          fontFamily={element.fontFamily}
          fontWeight={element.fontWeight}
          fontStyle={element.fontStyle}
          onPatch={(patch) => update(patch)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Text color</Label>
        <DesignColorPicker value={element.color} onChange={(hex) => update({ color: hex })} />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Text align</Label>
        <Select value={element.textAlign} onValueChange={(v) => update({ textAlign: v as "left" | "center" | "right" })}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Background</Label>
        <DesignColorPicker
          value={element.backgroundColor ?? "#ffffff"}
          onChange={(hex) => update({ backgroundColor: hex })}
        />
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
