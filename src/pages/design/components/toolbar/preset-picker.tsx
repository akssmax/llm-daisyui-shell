import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlusCircle } from "lucide-react"
import { PRESET_SIZES, createBlankDocument, type PresetKey } from "../../lib/design-presets"
import { useDesignStore } from "../../store/design-store"

export function PresetPicker() {
  const [open, setOpen] = useState(false)
  const setDocument = useDesignStore((s) => s.setDocument)
  const resetDesignChatThread = useDesignStore((s) => s.resetDesignChatThread)

  function handleSelect(key: PresetKey) {
    const doc = createBlankDocument(key)
    setDocument(doc)
    resetDesignChatThread()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" aria-label="New design from preset sizes">
              <PlusCircle className="h-3.5 w-3.5" />
              New Design
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">New design from preset sizes</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a canvas size</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {(Object.entries(PRESET_SIZES) as [PresetKey, (typeof PRESET_SIZES)[PresetKey]][]).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div
                className="bg-muted rounded"
                style={{
                  width: 60,
                  height: Math.round(60 * (preset.height / preset.width)),
                  maxHeight: 60,
                  flexShrink: 0,
                }}
              />
              <div>
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="text-muted-foreground text-xs">
                  {preset.width}×{preset.height}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
