import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { TAILWIND_BASE_SWATCHES, TAILWIND_COLOR_RAMPS, TAILWIND_SHADES } from "../../lib/tailwind-color-palette"

interface Props {
  value: string
  onChange: (hex: string) => void
  label?: string
}

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase()
}

export function DesignColorPicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const safeValue = typeof value === "string" && value.trim().length > 0 ? value.trim() : "#000000"
  const safeValueLower = normalizeHex(safeValue)

  const pick = (hex: string) => {
    onChange(hex)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? "Pick color"}
          className="h-7 w-full cursor-pointer rounded border border-input flex items-center gap-1.5 px-1.5 hover:bg-accent transition-colors"
        >
          <span
            className="size-4 shrink-0 rounded-sm border border-black/10"
            style={{ backgroundColor: safeValue }}
          />
          <span className="text-xs font-mono text-muted-foreground truncate">{safeValue}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(420px,calc(100vw-2rem))] max-h-[min(70vh,520px)] overflow-y-auto p-3 space-y-3"
      >
        <p className="text-xs font-medium text-muted-foreground sticky top-0 bg-popover z-10 pb-1">
          Tailwind colors
        </p>

        <div className="flex gap-1.5">
          {TAILWIND_BASE_SWATCHES.map((s) => (
            <button
              key={s.label}
              type="button"
              title={`${s.label} ${s.hex}`}
              aria-label={s.label}
              onClick={() => pick(s.hex)}
              className={cn(
                "size-7 rounded border border-black/10 cursor-pointer transition-transform hover:scale-110 shrink-0",
                safeValueLower === normalizeHex(s.hex) && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
              style={{ backgroundColor: s.hex }}
            />
          ))}
        </div>

        {TAILWIND_COLOR_RAMPS.map((ramp) => (
          <section key={ramp.name} className="space-y-1.5">
            <p className="text-xs font-medium capitalize text-foreground">{ramp.name}</p>
            <div className="grid grid-cols-11 gap-0.5">
              {TAILWIND_SHADES.map((shade) => {
                const hex = ramp.shades[shade]
                const id = `${ramp.name}-${shade}`
                return (
                  <button
                    key={id}
                    type="button"
                    title={`${id}\n${hex}`}
                    aria-label={id}
                    onClick={() => pick(hex)}
                    className={cn(
                      "group flex flex-col items-center gap-0.5 rounded p-0.5 cursor-pointer hover:bg-muted/60",
                      safeValueLower === normalizeHex(hex) && "ring-2 ring-primary ring-offset-1 ring-offset-background rounded",
                    )}
                  >
                    <span
                      className="size-6 rounded-sm border border-black/10 shrink-0 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[9px] leading-none text-muted-foreground tabular-nums">{shade}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        <div className="flex items-center gap-2 pt-1 border-t sticky bottom-0 bg-popover">
          <span className="text-xs text-muted-foreground shrink-0">Custom</span>
          <input
            type="color"
            value={safeValue.startsWith("#") ? safeValue : "#6366F1"}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 flex-1 cursor-pointer rounded border border-input"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
