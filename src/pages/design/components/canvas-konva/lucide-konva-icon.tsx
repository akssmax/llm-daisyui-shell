import { Group, Path } from "react-konva"
import {
  collectIconPathSpecs,
  DEFAULT_LUCIDE_STROKE_WIDTH,
  getLucideIconNode,
  isIconPathFilled,
  LUCIDE_VIEWBOX_SIZE,
} from "../../lib/lucide-icon-registry"

type Props = {
  iconName: string
  color: string
  width: number
  height: number
  /** Stroke width in screen pixels (Lucide default 2). */
  strokeWidth?: number
}

/**
 * Renders a Lucide icon inside a 24×24 viewBox, scaled to fit width×height.
 * Stroke width stays constant in pixels when the element is resized (non-scaling stroke).
 */
export function LucideKonvaIcon({ iconName, color, width, height, strokeWidth = DEFAULT_LUCIDE_STROKE_WIDTH }: Props) {
  const node = getLucideIconNode(iconName)
  if (!node) return null

  const paths = collectIconPathSpecs(node)
  if (paths.length === 0) return null

  const scale = Math.min(width, height) / LUCIDE_VIEWBOX_SIZE
  if (scale <= 0) return null

  // Counteract group scale so stroke stays `strokeWidth` pixels on screen.
  const localStroke = strokeWidth / scale

  return (
    <Group scaleX={scale} scaleY={scale} width={LUCIDE_VIEWBOX_SIZE} height={LUCIDE_VIEWBOX_SIZE}>
      {paths.map((spec, i) => {
        const filled = isIconPathFilled(spec)
        const sw = spec.strokeWidth ?? localStroke
        return (
          <Path
            key={i}
            data={spec.d}
            fill={filled ? (spec.fill === "currentColor" ? color : spec.fill) : undefined}
            fillEnabled={filled}
            stroke={filled ? undefined : color}
            strokeEnabled={!filled}
            strokeWidth={filled ? 0 : sw}
            lineCap={(spec.strokeLinecap as "butt" | "round" | "square") ?? "round"}
            lineJoin={(spec.strokeLinejoin as "miter" | "round" | "bevel") ?? "round"}
            listening={false}
            perfectDrawEnabled={false}
          />
        )
      })}
    </Group>
  )
}
