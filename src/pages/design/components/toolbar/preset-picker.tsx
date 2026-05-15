import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlusCircle, Sparkles } from "lucide-react"
import {
  PRESET_SIZES,
  AI_AUTO_PRESET,
  createBlankDocument,
  type PresetKey,
  type CanvasPresetMode,
} from "../../lib/design-presets"
import { useDesignStore } from "../../store/design-store"
import { cn } from "@/lib/utils"

export function PresetPicker() {
  const [open, setOpen] = useState(false)
  const setDocument = useDesignStore((s) => s.setDocument)
  const clearDocument = useDesignStore((s) => s.clearDocument)
  const setCanvasPresetMode = useDesignStore((s) => s.setCanvasPresetMode)
  const resetDesignChatThread = useDesignStore((s) => s.resetDesignChatThread)
  const canvasPresetMode = useDesignStore((s) => s.canvasPresetMode)

  function handleSelect(key: CanvasPresetMode) {
    setCanvasPresetMode(key)
    if (key === "auto") {
      // Keep canvas empty; agent pipeline picks format/size from the prompt on first message.
      clearDocument()
    } else {
      setDocument(createBlankDocument(key))
    }
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
          <button
            type="button"
            onClick={() => handleSelect("auto")}
            className={cn(
              "col-span-2 flex flex-row items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
              canvasPresetMode === "auto" && "border-primary bg-primary/5",
            )}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{AI_AUTO_PRESET.label}</p>
              <p className="text-muted-foreground text-xs">
                Resume, A4, cover letter, email, poster, website — sized from your prompt
              </p>
            </div>
          </button>

          {(Object.entries(PRESET_SIZES) as [PresetKey, (typeof PRESET_SIZES)[PresetKey]][]).map(
            ([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelect(key)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:text-accent-foreground",
                  canvasPresetMode === key && "border-primary bg-primary/5",
                )}
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
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
