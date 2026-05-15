import { Label } from "@/components/ui/label"
import type { SilhouetteElement } from "../../types"
import { useDesignStore } from "../../store/design-store"
import { DesignColorPicker } from "./design-color-picker"
import { AGENT_AVATAR_SHAPES } from "../../lib/agent-silhouette-registry"

interface Props {
  element: SilhouetteElement
  pageId: string
}

export function SilhouetteProperties({ element, pageId }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)
  const update = (patch: Partial<SilhouetteElement>) =>
    applyPatches([{ op: "update_element", pageId, elementId: element.id, patch }], { clearSelection: false })

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Agent shape</Label>
        <select
          value={element.shapeName}
          onChange={(e) => update({ shapeName: e.target.value })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {AGENT_AVATAR_SHAPES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Fill color</Label>
        <DesignColorPicker value={element.color} onChange={(hex) => update({ color: hex })} />
      </div>
    </div>
  )
}
