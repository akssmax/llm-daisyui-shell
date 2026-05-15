import { Path } from "react-konva"
import { collectIconPathSpecs, getLucideIconNode } from "../../lib/lucide-icon-registry"

const LUCIDE_VIEWBOX = 24

type Props = {
  iconName: string
  color: string
  width: number
  height: number
}

export function LucideKonvaIcon({ iconName, color, width, height }: Props) {
  const node = getLucideIconNode(iconName)
  if (!node) return null

  const paths = collectIconPathSpecs(node)
  if (paths.length === 0) return null

  const scale = Math.min(width, height) / LUCIDE_VIEWBOX

  return (
    <>
      {paths.map((spec, i) => {
        const usesFill = spec.fill && spec.fill !== "none"
        const strokeWidth = spec.strokeWidth ?? 2
        return (
          <Path
            key={i}
            data={spec.d}
            x={0}
            y={0}
            scaleX={scale}
            scaleY={scale}
            fill={usesFill ? color : "transparent"}
            stroke={usesFill ? undefined : color}
            strokeWidth={usesFill ? 0 : strokeWidth * scale}
            lineCap={(spec.strokeLinecap as "butt" | "round" | "square") ?? "round"}
            lineJoin={(spec.strokeLinejoin as "miter" | "round" | "bevel") ?? "round"}
            listening={false}
          />
        )
      })}
    </>
  )
}
