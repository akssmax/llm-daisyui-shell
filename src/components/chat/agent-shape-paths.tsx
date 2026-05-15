import { SHAPE_PATH_DATA, SHAPE_VIEWBOX } from "@/assets/agent-shape-path-data"

export const AGENT_AVATAR_SHAPES = [
  "Circle",
  "Square",
  "Slanted",
  "Arch",
  "Fan",
  "Arrow",
  "Semicircle",
  "Oval",
  "Pill",
  "Triangle",
  "Diamond",
  "Hexagon",
  "Pentagon",
  "Gem",
  "Very sunny",
  "Sunny",
  "4-sided cookie",
  "6-sided cookie",
  "7-sided cookie",
  "9-sided cookie",
  "12-sided cookie",
  "Ghost-ish",
  "4-leaf clover",
  "8-leaf clover",
  "Burst",
  "Soft burst",
  "Shape36",
  "Boom",
  "Soft boom",
  "Flower",
  "Puffy",
  "Puffy diamond",
  "Pixel Circle",
  "Pixel triangle",
  "Bun",
  "Heart",
] as const

export type AgentAvatarShape = (typeof AGENT_AVATAR_SHAPES)[number]

export function ShapeSilhouette({
  shape,
  fill,
}: {
  shape: AgentAvatarShape
  fill: string
}) {
  const d = SHAPE_PATH_DATA[shape] ?? SHAPE_PATH_DATA.Circle
  return <path d={d} fill={fill} />
}

export { SHAPE_VIEWBOX }
