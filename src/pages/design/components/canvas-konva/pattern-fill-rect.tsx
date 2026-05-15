import { Rect } from "react-konva"
import { getPatternTile } from "../../lib/fill-pattern-catalog"

type Props = {
  width: number
  height: number
  fill: string
  patternId: string
  patternColor: string
  x?: number
  y?: number
  cornerRadius?: number
  opacity?: number
}

export function PatternFillRect({
  width,
  height,
  fill,
  patternId,
  patternColor,
  x = 0,
  y = 0,
  cornerRadius = 0,
  opacity = 1,
}: Props) {
  const tile = getPatternTile(patternId, patternColor, fill)
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        cornerRadius={cornerRadius}
        opacity={opacity}
        listening={false}
        perfectDrawEnabled={false}
      />
      {tile ? (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          fillPatternImage={tile as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          cornerRadius={cornerRadius}
          opacity={opacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
    </>
  )
}
