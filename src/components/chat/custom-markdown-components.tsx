import { cn } from "@/lib/utils"

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "success" | "danger"
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  const toneClasses: Record<string, string> = {
    info: "border-primary/30 bg-primary/10",
    warning: "border-amber-500/30 bg-amber-500/10",
    success: "border-emerald-500/30 bg-emerald-500/10",
    danger: "border-destructive/30 bg-destructive/10",
  }

  return (
    <div
      className={cn(
        "my-4 rounded-xl border p-5 text-[15px] leading-7 text-foreground",
        toneClasses[tone],
        className
      )}
    >
      {title && <div className="mb-2 text-[15px] font-semibold text-foreground">{title}</div>}
      <div className="text-[15px] leading-7 text-muted-foreground">{children}</div>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("my-4 rounded-xl border border-border bg-card px-4 py-4", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold leading-tight text-foreground">{value}</div>
    </div>
  )
}

export const markdownComponentRegistry = {
  Callout,
  KpiCard,
}

