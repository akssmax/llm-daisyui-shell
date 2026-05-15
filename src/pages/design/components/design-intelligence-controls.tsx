import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getAllLayouts, getAllStylePresets } from "../lib/layout-intelligence/layout-catalog"
import { retrieveLayouts } from "../lib/layout-intelligence/layout-retrieval"
import { useDesignStore } from "../store/design-store"

function LayoutWireframe({ layoutId }: { layoutId: string }) {
  const layout = getAllLayouts().find((l) => l.id === layoutId)
  if (!layout) return null
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-full rounded border bg-muted/30" aria-hidden>
      {layout.regions.map((r) => (
        <rect
          key={r.id}
          x={r.relativeRect.x * 100}
          y={r.relativeRect.y * 100}
          width={r.relativeRect.w * 100}
          height={r.relativeRect.h * 100}
          fill="currentColor"
          className="text-primary/25"
          stroke="currentColor"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}

export function DesignIntelligenceControls() {
  const {
    stylePresetId,
    setStylePresetId,
    densityOverride,
    hierarchyOverride,
    setDensityOverride,
    setHierarchyOverride,
    designVariants,
    activeVariantIndex,
    applyDesignVariant,
    setPendingVariantLayoutIds,
    setRegenerationMode,
    lastCritiqueScore,
    lastLayoutId,
    designAgentPipelineEnabled,
  } = useDesignStore(
    useShallow((s) => ({
      stylePresetId: s.stylePresetId,
      setStylePresetId: s.setStylePresetId,
      densityOverride: s.densityOverride,
      hierarchyOverride: s.hierarchyOverride,
      setDensityOverride: s.setDensityOverride,
      setHierarchyOverride: s.setHierarchyOverride,
      designVariants: s.designVariants,
      activeVariantIndex: s.activeVariantIndex,
      applyDesignVariant: s.applyDesignVariant,
      setPendingVariantLayoutIds: s.setPendingVariantLayoutIds,
      setRegenerationMode: s.setRegenerationMode,
      lastCritiqueScore: s.lastCritiqueScore,
      lastLayoutId: s.lastLayoutId,
      designAgentPipelineEnabled: s.designAgentPipelineEnabled,
    })),
  )

  if (!designAgentPipelineEnabled) return null

  const stylePresets = getAllStylePresets()
  const topLayouts = retrieveLayouts({ userPrompt: "social startup" }).top3

  return (
    <div className="space-y-3 border-t px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Style</Label>
        <Select
          value={stylePresetId ?? "none"}
          onValueChange={(v) => setStylePresetId(v === "none" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Style preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Auto</SelectItem>
            {stylePresets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={densityOverride ?? "auto"}
          onValueChange={(v) =>
            setDensityOverride(v === "auto" ? null : (v as "low" | "medium" | "high"))
          }
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="Density" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Density</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={hierarchyOverride ?? "auto"}
          onValueChange={(v) =>
            setHierarchyOverride(v === "auto" ? null : (v as "strong" | "balanced"))
          }
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="Hierarchy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Hierarchy</SelectItem>
            <SelectItem value="strong">Strong</SelectItem>
            <SelectItem value="balanced">Balanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {lastLayoutId && lastCritiqueScore != null && (
        <p className="text-xs text-muted-foreground">
          Layout: {lastLayoutId} · Quality {lastCritiqueScore}/100
        </p>
      )}

      {designVariants && designVariants.length > 1 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Variants</Label>
          <div className="grid grid-cols-3 gap-2">
            {designVariants.map((v, i) => (
              <button
                key={v.layoutId}
                type="button"
                onClick={() => applyDesignVariant(i)}
                className={cn(
                  "rounded-md border p-1.5 text-left transition-colors",
                  i === activeVariantIndex ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <LayoutWireframe layoutId={v.layoutId} />
                <span className="mt-1 block truncate text-[10px] font-medium">{v.layoutId}</span>
                <span className="text-[10px] text-muted-foreground">{v.critique.compositeScore}/100</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(["layout", "style", "typography"] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setRegenerationMode(mode)
              if (mode === "layout") {
                setPendingVariantLayoutIds(topLayouts.map((l) => l.id))
              }
            }}
          >
            {mode === "layout" ? "Regen layout" : mode === "style" ? "Regen style" : "Regen type"}
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Layout picks (next run)</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {topLayouts.map((l) => (
            <button
              key={l.id}
              type="button"
              className="rounded border p-1 hover:bg-muted/50"
              onClick={() =>
                setPendingVariantLayoutIds([
                  l.id,
                  ...topLayouts.filter((x) => x.id !== l.id).map((x) => x.id),
                ])
              }
              title={l.id}
            >
              <LayoutWireframe layoutId={l.id} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
