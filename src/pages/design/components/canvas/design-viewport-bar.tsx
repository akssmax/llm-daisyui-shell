import { useShallow } from "zustand/react/shallow"
import { Grid3X3, Magnet, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useDesignStore } from "../../store/design-store"

/** Bottom bar: zoom %, slider, fit, grid, snap (Canva-style). */
export function DesignViewportBar() {
  const { viewport, setViewport, resetViewport, requestCanvasFit } = useDesignStore(
    useShallow((s) => ({
      viewport: s.viewport,
      setViewport: s.setViewport,
      resetViewport: s.resetViewport,
      requestCanvasFit: s.requestCanvasFit,
    })),
  )

  const pct = Math.round(viewport.userZoom * 100)

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t bg-muted/20 px-3 py-2">
      <div className="flex min-w-[120px] max-w-[200px] flex-1 items-center gap-2">
        <Label className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">Zoom</Label>
        <Slider
          value={[pct]}
          min={25}
          max={200}
          step={5}
          onValueChange={([v]) => setViewport({ userZoom: (v ?? 100) / 100 })}
          className="flex-1"
        />
        <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">{pct}%</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => {
          resetViewport()
          requestCanvasFit()
        }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Fit
      </Button>
      <div className="flex items-center gap-1.5">
        <Grid3X3 className="text-muted-foreground h-3.5 w-3.5" />
        <Switch
          checked={viewport.showGrid}
          onCheckedChange={(c) => setViewport({ showGrid: c })}
          className="scale-90"
        />
        <span className="text-muted-foreground text-xs">Grid</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Magnet className="text-muted-foreground h-3.5 w-3.5" />
        <Switch
          checked={viewport.snapToGrid}
          onCheckedChange={(c) => setViewport({ snapToGrid: c })}
          className="scale-90"
        />
        <span className="text-muted-foreground text-xs">Snap</span>
      </div>
    </div>
  )
}
