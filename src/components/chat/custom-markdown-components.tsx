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
    <div className={cn("rounded-xl border p-4 text-sm text-foreground", toneClasses[tone], className)}>
      {title && <div className="mb-1 text-sm font-medium">{title}</div>}
      <div className="text-sm text-muted-foreground">{children}</div>
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
    <div className={cn("rounded-xl border border-border bg-card px-4 py-3", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}

export const markdownComponentRegistry = {
  Callout,
  KpiCard,
}

