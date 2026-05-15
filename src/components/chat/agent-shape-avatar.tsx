import type { ReactNode } from "react"
import { motion } from "motion/react"

import {
  AGENT_AVATAR_SHAPES,
  ShapeSilhouette,
  SHAPE_VIEWBOX,
  type AgentAvatarShape,
} from "@/components/chat/agent-shape-paths"
import { cn } from "@/lib/utils"

export { AGENT_AVATAR_SHAPES, type AgentAvatarShape }

function normalizeShape(shape: AgentAvatarShape | string): AgentAvatarShape {
  const legacyMap: Record<string, AgentAvatarShape> = {
    circle: "Circle",
    "rounded-square": "Square",
    squircle: "Pill",
    hexagon: "Hexagon",
    diamond: "Diamond",
    clover: "4-leaf clover",
    burst: "Burst",
    heart: "Heart",
    pixel: "Pixel Circle",
  }
  const normalized = legacyMap[shape] ?? shape
  return AGENT_AVATAR_SHAPES.includes(normalized as AgentAvatarShape)
    ? (normalized as AgentAvatarShape)
    : "Circle"
}

export function AgentShapeAvatar({
  shape = "Circle",
  color = "var(--color-primary)",
  icon,
  className,
}: {
  shape?: AgentAvatarShape | string
  color?: string
  icon: ReactNode
  className?: string
}) {
  const resolvedShape = normalizeShape(shape)

  return (
    <span
      className={cn(
        "group relative inline-flex size-8 shrink-0 items-center justify-center overflow-visible",
        className
      )}
    >
      <motion.svg
        aria-hidden
        viewBox={SHAPE_VIEWBOX}
        className="absolute inset-0 size-full"
        whileHover={{ rotate: 10, scale: 1.03 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <ShapeSilhouette shape={resolvedShape} fill={color} />
      </motion.svg>
      <span className="relative z-10 text-background">{icon}</span>
    </span>
  )
}
