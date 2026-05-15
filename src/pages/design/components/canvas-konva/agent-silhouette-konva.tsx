import { Group, Path } from "react-konva"
import { getSilhouettePathData, SILHOUETTE_VIEWBOX_SIZE } from "../../lib/agent-silhouette-registry"

type Props = {
  shapeName: string
  color: string
  width: number
  height: number
}

/** Renders an agent avatar silhouette scaled from 380×380 viewBox to element bounds. */
export function AgentSilhouetteKonva({ shapeName, color, width, height }: Props) {
  const pathData = getSilhouettePathData(shapeName)
  if (!pathData) return null

  const scale = Math.min(width, height) / SILHOUETTE_VIEWBOX_SIZE
  if (scale <= 0) return null

  return (
    <Group scaleX={scale} scaleY={scale} width={SILHOUETTE_VIEWBOX_SIZE} height={SILHOUETTE_VIEWBOX_SIZE}>
      <Path data={pathData} fill={color} listening={false} perfectDrawEnabled={false} />
    </Group>
  )
}
