import type { ReactNode } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

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

const SHAPE_MASK_MAP: Record<AgentAvatarShape, string> = {
  Circle: "https://www.figma.com/api/mcp/asset/c9c3cbf1-d4bc-4969-b25a-6db4f429fec7",
  Square: "https://www.figma.com/api/mcp/asset/e43c6b51-43ac-41dd-8aee-fb6961a15b42",
  Slanted: "https://www.figma.com/api/mcp/asset/d5dae265-d647-4a4f-bd4d-4d31d19d8957",
  Arch: "https://www.figma.com/api/mcp/asset/e1553d9a-f0b0-4d06-b8c7-92c978b82b99",
  Fan: "https://www.figma.com/api/mcp/asset/6ff9a41e-d74f-4ca7-91d7-aeaa6f04bbfb",
  Arrow: "https://www.figma.com/api/mcp/asset/4be895a8-0caf-40ec-96ee-dea0c7992318",
  Semicircle: "https://www.figma.com/api/mcp/asset/011eb4d4-c2a0-430a-bdb4-2b0612dcd385",
  Oval: "https://www.figma.com/api/mcp/asset/5d386ea6-99ea-4eda-9a2f-5e25cc616001",
  Pill: "https://www.figma.com/api/mcp/asset/ee3419fe-970b-45e2-950e-45381cf2d161",
  Triangle: "https://www.figma.com/api/mcp/asset/c6744ad3-d9d2-4b14-a594-aa62e822089a",
  Diamond: "https://www.figma.com/api/mcp/asset/8bc8b427-40b2-44fb-a3d6-983c053c8f2f",
  Hexagon: "https://www.figma.com/api/mcp/asset/ed2aaaec-fbed-49ce-aa3d-5cf875f80d96",
  Pentagon: "https://www.figma.com/api/mcp/asset/1a835be8-4a64-41f1-bde8-16112502280f",
  Gem: "https://www.figma.com/api/mcp/asset/b6979548-0d79-4fd1-9beb-ccfbd041c1dc",
  "Very sunny": "https://www.figma.com/api/mcp/asset/5d8491ed-aac3-4439-b97e-68f60f240b81",
  Sunny: "https://www.figma.com/api/mcp/asset/c39312a1-aa2f-4fa3-bc5c-eca1966a60e2",
  "4-sided cookie": "https://www.figma.com/api/mcp/asset/17dd20a1-4099-4756-aec4-1ba2cd89f915",
  "6-sided cookie": "https://www.figma.com/api/mcp/asset/efad7c3b-3938-46cd-976f-7b2bb3e5df28",
  "7-sided cookie": "https://www.figma.com/api/mcp/asset/0ae90496-9093-4aac-b53c-12b1c8e98749",
  "9-sided cookie": "https://www.figma.com/api/mcp/asset/94058bf4-0feb-4385-b300-ed2ba03bbe0c",
  "12-sided cookie": "https://www.figma.com/api/mcp/asset/fa93b0c1-4f03-4eac-a137-b2b203cac5ec",
  "Ghost-ish": "https://www.figma.com/api/mcp/asset/64555792-cc9d-42da-80cd-8cdcba367262",
  "4-leaf clover": "https://www.figma.com/api/mcp/asset/afaa8b00-c25e-4d93-8ce1-9c708a40a670",
  "8-leaf clover": "https://www.figma.com/api/mcp/asset/0f5a5b85-489e-4955-8b4f-ee07a62fcbf7",
  Burst: "https://www.figma.com/api/mcp/asset/f5d8a0d1-6cc9-4681-bec3-2a261f5c8a19",
  "Soft burst": "https://www.figma.com/api/mcp/asset/066fd299-e56d-4a49-ba9d-73460249c9cf",
  Shape36: "https://www.figma.com/api/mcp/asset/066fd299-e56d-4a49-ba9d-73460249c9cf",
  Boom: "https://www.figma.com/api/mcp/asset/34e43324-c5d9-4017-82b0-3d6ddd34fd0e",
  "Soft boom": "https://www.figma.com/api/mcp/asset/6481a1d6-ee66-4feb-bb87-2558ecca0640",
  Flower: "https://www.figma.com/api/mcp/asset/2556146f-5fee-4e1e-86cf-07a5b2d33b68",
  Puffy: "https://www.figma.com/api/mcp/asset/823bdf35-73c5-4e29-8f12-90dea8a83127",
  "Puffy diamond": "https://www.figma.com/api/mcp/asset/04cc5a5b-b046-4b36-9f48-7a4b0beb2899",
  "Pixel Circle": "https://www.figma.com/api/mcp/asset/581ec6d2-00a0-4f4e-b6ff-b236dd1a9d06",
  "Pixel triangle": "https://www.figma.com/api/mcp/asset/5db38576-bb6a-4eb1-8492-632a6ee72073",
  Bun: "https://www.figma.com/api/mcp/asset/d706be44-a44d-4a6c-b3cb-d1d0a915f54d",
  Heart: "https://www.figma.com/api/mcp/asset/d031002e-22e2-41f8-80f9-6e333dae8a1b",
}

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
  const maskUrl = SHAPE_MASK_MAP[resolvedShape]

  return (
    <span
      className={cn(
        "group relative inline-flex size-8 shrink-0 items-center justify-center overflow-visible",
        className
      )}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0"
        whileHover={{ rotate: 10, scale: 1.03 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{
          backgroundColor: color,
          maskImage: `url(${maskUrl})`,
          WebkitMaskImage: `url(${maskUrl})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
      <span className="relative z-10 text-background">{icon}</span>
    </span>
  )
}

