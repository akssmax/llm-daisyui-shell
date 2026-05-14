import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Curated Tailwind v3 palette — exact hex values the AI is told to use
const SWATCHES: Array<{ label: string; hex: string }> = [
  // Slate scale
  { label: "slate-50",  hex: "#F8FAFC" },
  { label: "slate-100", hex: "#F1F5F9" },
  { label: "slate-200", hex: "#E2E8F0" },
  { label: "slate-300", hex: "#CBD5E1" },
  { label: "slate-400", hex: "#94A3B8" },
  { label: "slate-500", hex: "#64748B" },
  { label: "slate-600", hex: "#475569" },
  { label: "slate-700", hex: "#334155" },
  { label: "slate-800", hex: "#1E293B" },
  { label: "slate-900", hex: "#0F172A" },
  // Pure
  { label: "white",     hex: "#FFFFFF" },
  { label: "black",     hex: "#000000" },
  // Indigo/Violet
  { label: "indigo-400",  hex: "#818CF8" },
  { label: "indigo-500",  hex: "#6366F1" },
  { label: "indigo-600",  hex: "#4F46E5" },
  { label: "violet-500",  hex: "#8B5CF6" },
  { label: "violet-600",  hex: "#7C3AED" },
  { label: "purple-500",  hex: "#A855F7" },
  // Blue
  { label: "blue-400",  hex: "#60A5FA" },
  { label: "blue-500",  hex: "#3B82F6" },
  { label: "blue-600",  hex: "#2563EB" },
  { label: "sky-500",   hex: "#0EA5E9" },
  { label: "cyan-500",  hex: "#06B6D4" },
  { label: "teal-500",  hex: "#14B8A6" },
  // Green
  { label: "emerald-400", hex: "#34D399" },
  { label: "emerald-500", hex: "#10B981" },
  { label: "green-500",   hex: "#22C55E" },
  { label: "lime-500",    hex: "#84CC16" },
  // Yellow/Orange/Red
  { label: "yellow-400",  hex: "#FACC15" },
  { label: "amber-500",   hex: "#F59E0B" },
  { label: "orange-500",  hex: "#F97316" },
  { label: "red-500",     hex: "#EF4444" },
  { label: "rose-500",    hex: "#F43F5E" },
  { label: "pink-500",    hex: "#EC4899" },
]

interface Props {
  value: string
  onChange: (hex: string) => void
  label?: string
}

export function DesignColorPicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)

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
            style={{ backgroundColor: value }}
          />
          <span className="text-xs font-mono text-muted-foreground truncate">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Tailwind colors</p>
        <div className="grid grid-cols-6 gap-1.5">
          {SWATCHES.map((s) => (
            <button
              key={s.hex}
              type="button"
              title={s.label}
              aria-label={s.label}
              onClick={() => { onChange(s.hex); setOpen(false) }}
              className={cn(
                "size-7 rounded border border-black/10 cursor-pointer transition-transform hover:scale-110 shrink-0",
                value.toLowerCase() === s.hex.toLowerCase() &&
                  "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
              style={{ backgroundColor: s.hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Custom</span>
          <input
            type="color"
            value={value.startsWith("#") ? value : "#6366F1"}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 flex-1 cursor-pointer rounded border border-input"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
