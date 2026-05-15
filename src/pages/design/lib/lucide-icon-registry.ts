import { icons, type IconNode } from "lucide"

/** Curated Lucide icons for marketing / UI designs (kebab-case). */
export const LUCIDE_ICON_ALLOWLIST = [
  "arrow-right",
  "arrow-left",
  "arrow-up",
  "arrow-down",
  "check",
  "check-circle",
  "x",
  "plus",
  "minus",
  "star",
  "heart",
  "thumbs-up",
  "mail",
  "phone",
  "map-pin",
  "calendar",
  "clock",
  "users",
  "user",
  "zap",
  "shield",
  "shield-check",
  "sparkles",
  "lightbulb",
  "target",
  "trending-up",
  "bar-chart",
  "pie-chart",
  "globe",
  "link",
  "download",
  "upload",
  "share-2",
  "message-circle",
  "bell",
  "settings",
  "search",
  "home",
  "building",
  "briefcase",
  "award",
  "gift",
  "rocket",
  "leaf",
  "sun",
  "moon",
  "cloud",
  "lock",
  "unlock",
  "eye",
  "bookmark",
] as const

export type LucideIconName = (typeof LUCIDE_ICON_ALLOWLIST)[number]

const ALLOWLIST_SET = new Set<string>(LUCIDE_ICON_ALLOWLIST)

const ALIASES: Record<string, string> = {
  arrowright: "arrow-right",
  arrowleft: "arrow-left",
  checkcircle: "check-circle",
  thumbsup: "thumbs-up",
  mappin: "map-pin",
  trendingup: "trending-up",
  barchart: "bar-chart",
  piechart: "pie-chart",
  share2: "share-2",
  messagecircle: "message-circle",
  shieldcheck: "shield-check",
}

function kebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
}

function iconNameToPascal(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

export function normalizeIconName(name: string): LucideIconName | null {
  const raw = name.trim()
  if (!raw) return null
  const kebab = kebabCase(raw)
  const alias = ALIASES[kebab.replace(/-/g, "")] ?? kebab
  if (ALLOWLIST_SET.has(alias)) return alias as LucideIconName
  return null
}

export function getLucideIconNode(name: string): IconNode[] | null {
  const normalized = normalizeIconName(name)
  if (!normalized) return null
  const pascal = iconNameToPascal(normalized)
  const node = icons[pascal as keyof typeof icons]
  return node ?? null
}

export function lucideAllowlistForPrompt(): string {
  return LUCIDE_ICON_ALLOWLIST.join(", ")
}

export type IconPathSpec = {
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeLinecap?: string
  strokeLinejoin?: string
}

/** Flatten Lucide IconNode tree into SVG path specs for Konva / canvas export. */
export function collectIconPathSpecs(iconNode: IconNode[]): IconPathSpec[] {
  const out: IconPathSpec[] = []

  function walk(nodes: IconNode[]) {
    for (const node of nodes) {
      if (!Array.isArray(node)) continue
      const [tag, attrs, children] = node
      if (tag === "path" && attrs && typeof attrs.d === "string") {
        out.push({
          d: attrs.d,
          fill: attrs.fill,
          stroke: attrs.stroke,
          strokeWidth: attrs.strokeWidth ? Number(attrs.strokeWidth) : undefined,
          strokeLinecap: attrs.strokeLinecap,
          strokeLinejoin: attrs.strokeLinejoin,
        })
      }
      if (tag === "circle" && attrs) {
        const cx = Number(attrs.cx ?? 12)
        const cy = Number(attrs.cy ?? 12)
        const r = Number(attrs.r ?? 0)
        out.push({
          d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`,
          fill: attrs.fill,
          stroke: attrs.stroke,
          strokeWidth: attrs.strokeWidth ? Number(attrs.strokeWidth) : undefined,
        })
      }
      if (tag === "line" && attrs) {
        const x1 = attrs.x1 ?? "0"
        const y1 = attrs.y1 ?? "0"
        const x2 = attrs.x2 ?? "0"
        const y2 = attrs.y2 ?? "0"
        out.push({
          d: `M ${x1} ${y1} L ${x2} ${y2}`,
          stroke: attrs.stroke,
          strokeWidth: attrs.strokeWidth ? Number(attrs.strokeWidth) : undefined,
          strokeLinecap: attrs.strokeLinecap,
        })
      }
      if (tag === "polyline" && attrs && typeof attrs.points === "string") {
        const pts = attrs.points.trim().split(/\s+/).map(Number)
        if (pts.length >= 4) {
          let d = `M ${pts[0]} ${pts[1]}`
          for (let i = 2; i < pts.length; i += 2) {
            d += ` L ${pts[i]} ${pts[i + 1]}`
          }
          out.push({
            d,
            fill: attrs.fill,
            stroke: attrs.stroke,
            strokeWidth: attrs.strokeWidth ? Number(attrs.strokeWidth) : undefined,
          })
        }
      }
      if (Array.isArray(children)) walk(children)
    }
  }

  walk(iconNode)
  return out
}
