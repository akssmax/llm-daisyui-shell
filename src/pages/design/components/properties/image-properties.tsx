import { useRef } from "react"
import { ImageUp } from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { ImageElement } from "../../types"
import { useDesignStore } from "../../store/design-store"

/** Keep in sync with design-toolbar image picker. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface Props {
  element: ImageElement
  pageId: string
}

export function ImageProperties({ element, pageId }: Props) {
  const applyPatches = useDesignStore((s) => s.applyPatches)
  const fileRef = useRef<HTMLInputElement>(null)
  const update = (patch: Partial<ImageElement>) =>
    applyPatches([{ op: "update_element", pageId, elementId: element.id, patch }], { clearSelection: false })

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Image</Label>
        <div className="flex max-h-28 min-h-[5.5rem] items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {element.src ? (
            <img
              src={element.src}
              alt=""
              className="max-h-28 w-full object-contain"
              draggable={false}
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">No image source</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (!f) return
            if (f.size > MAX_IMAGE_BYTES) {
              toast.error("Image must be 5 MB or smaller.")
              return
            }
            const reader = new FileReader()
            reader.onload = () => {
              const url = reader.result
              if (typeof url === "string") update({ src: url })
            }
            reader.readAsDataURL(f)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <ImageUp className="h-3.5 w-3.5 shrink-0 opacity-80" />
          Replace image…
        </Button>
        <p className="text-[10px] text-muted-foreground">Upload PNG, JPG, or WebP (max 5 MB). Replaces the current layer only.</p>
      </div>

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
