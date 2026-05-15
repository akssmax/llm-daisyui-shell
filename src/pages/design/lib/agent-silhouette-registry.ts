import { SHAPE_PATH_DATA } from "@/assets/agent-shape-path-data"
import { AGENT_AVATAR_SHAPES, type AgentAvatarShape } from "@/components/chat/agent-shape-paths"

export { AGENT_AVATAR_SHAPES, type AgentAvatarShape }

export const SILHOUETTE_VIEWBOX_SIZE = 380

const SHAPE_SET = new Set<string>(AGENT_AVATAR_SHAPES)

const ALIASES: Record<string, AgentAvatarShape> = {
  heart: "Heart",
  burst: "Burst",
  softburst: "Soft burst",
  "soft-burst": "Soft burst",
  circle: "Circle",
  flower: "Flower",
  boom: "Boom",
  softboom: "Soft boom",
  "soft-boom": "Soft boom",
  ghost: "Ghost-ish",
  "ghost-ish": "Ghost-ish",
  clover: "4-leaf clover",
  "4-leaf-clover": "4-leaf clover",
}

function titleCaseWords(input: string): string {
  return input
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

export function normalizeSilhouetteName(name: string): AgentAvatarShape | null {
  const raw = name.trim()
  if (!raw) return null
  if (SHAPE_SET.has(raw)) return raw as AgentAvatarShape
  const alias = ALIASES[raw.toLowerCase().replace(/\s+/g, "")]
  if (alias) return alias
  const titled = titleCaseWords(raw)
  if (SHAPE_SET.has(titled)) return titled as AgentAvatarShape
  for (const shape of AGENT_AVATAR_SHAPES) {
    if (shape.toLowerCase() === raw.toLowerCase()) return shape
  }
  return null
}

export function extractSilhouetteFromText(content: string): AgentAvatarShape | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  const kindMatch = trimmed.match(/silhouette\s+kind\s*=\s*([a-zA-Z0-9\s-]+)/i)
  if (kindMatch) {
    const normalized = normalizeSilhouetteName(kindMatch[1].trim())
    if (normalized) return normalized
  }

  const nameMatch = trimmed.match(/shapeName\s*:\s*["']?([a-zA-Z0-9\s-]+)/i)
  if (nameMatch) {
    const normalized = normalizeSilhouetteName(nameMatch[1].trim())
    if (normalized) return normalized
  }

  if (!/[:|]/.test(trimmed) && !/\s/.test(trimmed)) {
    return normalizeSilhouetteName(trimmed)
  }

  return null
}

export function getSilhouettePathData(name: string): string | null {
  const normalized = normalizeSilhouetteName(name)
  if (!normalized) return null
  return SHAPE_PATH_DATA[normalized] ?? null
}

export function silhouettesForPrompt(): string {
  return AGENT_AVATAR_SHAPES.join(", ")
}
