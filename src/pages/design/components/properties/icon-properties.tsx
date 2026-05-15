import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { IconElement } from "../../types"
import { useDesignStore } from "../../store/design-store"
import { DesignColorPicker } from "./design-color-picker"
import { LUCIDE_ICON_ALLOWLIST } from "../../lib/lucide-icon-registry"

interface Props {
  element: IconElement
  pageId: string
}

export function IconProperties({ element, pageId }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)
  const update = (patch: Partial<IconElement>) =>
    applyPatches([{ op: "update_element", pageId, elementId: element.id, patch }], { clearSelection: false })

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Icon</Label>
        <select
          value={element.iconName}
          onChange={(e) => update({ iconName: e.target.value })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {LUCIDE_ICON_ALLOWLIST.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Color</Label>
        <DesignColorPicker value={element.color} onChange={(hex) => update({ color: hex })} />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Stroke width (px)</Label>
        <Input
          type="number"
          value={element.strokeWidth ?? 2}
          min={0.5}
          max={12}
          step={0.5}
          onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
          className="h-7 text-xs"
        />
      </div>
    </div>
  )
}
