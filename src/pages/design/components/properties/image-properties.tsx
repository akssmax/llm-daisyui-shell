import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { ImageElement } from "../../types"
import { useDesignStore } from "../../store/design-store"

interface Props {
  element: ImageElement
  pageId: string
}

export function ImageProperties({ element, pageId }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)
  const update = (patch: Partial<ImageElement>) =>
    applyPatches([{ op: "update_element", pageId, elementId: element.id, patch }], { clearSelection: false })

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Object fit</Label>
        <Select
          value={element.objectFit}
          onValueChange={(v) => update({ objectFit: v as "cover" | "contain" | "fill" })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="fill">Fill</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
