import { forwardRef, memo, useEffect, useState } from "react"
import { Ellipse, Group, Image as KonvaImage, Line, Rect, Text, Arrow, Star, RegularPolygon } from "react-konva"
import type Konva from "konva"
import type { DesignElement, ImageElement } from "../../types"
import { fontFamilyForKonva } from "../../lib/design-fonts"
import { konvaFontStyleFromTextElement } from "../../lib/design-text-style"
import { AgentSilhouetteKonva } from "./agent-silhouette-konva"
import { LucideKonvaIcon } from "./lucide-konva-icon"
import { PatternFillRect } from "./pattern-fill-rect"

type Props = {
  element: DesignElement
  pageId: string
  interactionDisabled: boolean
  onSelect: (elementId: string, pageId: string) => void
  onTransformEnd: (elementId: string, attrs: { x: number; y: number; width: number; height: number; rotation: number }) => void
  onDragEnd: (elementId: string, x: number, y: number) => void
  /** Select tool + text element: double-click to open inline editor */
  onTextDblClick?: (elementId: string, pageId: string) => void
}

function useLoadedImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined)
  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => setImage(img)
    img.onerror = () => setImage(undefined)
    img.src = src
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])
  return image
}

/** Full-bounds hit target: Konva Groups do not hit-test unless a listening descendant draws a hit region. */
function ElementHitOverlay({ width, height, locked }: { width: number; height: number; locked: boolean }) {
  return (
    <Rect
      name="element-hit"
      x={0}
      y={0}
      width={width}
      height={height}
      fill="rgba(0,0,0,0.004)"
      listening={!locked}
      perfectDrawEnabled={false}
    />
  )
}

export const DesignElementNode = memo(
  forwardRef<Konva.Group, Props>(function DesignElementNode(
    { element, pageId, interactionDisabled, onSelect, onTransformEnd, onDragEnd, onTextDblClick },
    ref,
  ) {
    const locked = Boolean(element.locked) || interactionDisabled

    const bind = {
      listening: !locked,
      draggable: !locked,
      onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.evt.button !== 0) return
        e.cancelBubble = true
        onSelect(element.id, pageId)
      },
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true
        onSelect(element.id, pageId)
      },
      onTap: (e: Konva.KonvaEventObject<TouchEvent>) => {
        e.cancelBubble = true
        onSelect(element.id, pageId)
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const g = e.target.getType() === "Group" ? e.target : e.target.getParent()
        if (!g) return
        onDragEnd(element.id, g.x(), g.y())
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const node = (e.target.getType() === "Group" ? e.target : e.target.getParent()) as Konva.Group
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onTransformEnd(element.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(8, node.width() * scaleX),
          height: Math.max(8, node.height() * scaleY),
          rotation: node.rotation(),
        })
      },
    }

    if (element.kind === "text") {
      const fontStyle = konvaFontStyleFromTextElement(element)
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
          onDblClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true
            if (!locked && onTextDblClick) onTextDblClick(element.id, pageId)
          }}
          onDblTap={(e: Konva.KonvaEventObject<TouchEvent>) => {
            e.cancelBubble = true
            if (!locked && onTextDblClick) onTextDblClick(element.id, pageId)
          }}
        >
          <Text
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            text={element.content}
            fontFamily={fontFamilyForKonva(element.fontFamily)}
            fontSize={element.fontSize}
            fontStyle={fontStyle}
            fill={element.color}
            align={element.textAlign}
            lineHeight={element.lineHeight}
            verticalAlign="top"
            wrap="word"
            listening={false}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }

    if (element.kind === "image") {
      return <ImageGroup ref={ref} element={element} bind={bind} locked={locked} />
    }

    if (element.kind === "icon") {
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <LucideKonvaIcon
            iconName={element.iconName}
            color={element.color}
            width={element.width}
            height={element.height}
            strokeWidth={element.strokeWidth}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }

    if (element.kind === "silhouette") {
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <AgentSilhouetteKonva
            shapeName={element.shapeName}
            color={element.color}
            width={element.width}
            height={element.height}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }

    const shapePattern = element.kind === "shape" ? element.patternFill : undefined

    // shape
    const stroke = element.stroke
    const sw = element.strokeWidth ?? 0
    if (element.shape === "ellipse") {
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <Ellipse
            x={element.width / 2}
            y={element.height / 2}
            radiusX={element.width / 2}
            radiusY={element.height / 2}
            fill={element.fill}
            stroke={stroke}
            strokeWidth={sw}
            listening={false}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }
    if (element.shape === "triangle") {
      const pts = [element.width / 2, 0, element.width, element.height, 0, element.height]
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <Line points={pts} closed fill={element.fill} stroke={stroke} strokeWidth={sw} listening={false} />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }
    if (element.shape === "line") {
      const lineStroke = stroke ?? (element.fill !== "transparent" ? element.fill : "#64748b")
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <Line
            points={[0, 0, element.width, element.height]}
            stroke={lineStroke}
            strokeWidth={Math.max(1, sw || 2)}
            lineCap="round"
            listening={false}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }
    if (element.shape === "arrow") {
      const aStroke = stroke ?? (element.fill !== "transparent" ? element.fill : "#64748b")
      const pl = Math.min(20, Math.max(8, Math.min(element.width, element.height) / 3))
      const pw = Math.min(14, Math.max(6, Math.min(element.width, element.height) / 4))
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <Arrow
            points={[0, 0, element.width, element.height]}
            stroke={aStroke}
            fill={aStroke}
            strokeWidth={Math.max(1, sw || 2)}
            pointerLength={pl}
            pointerWidth={pw}
            listening={false}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }
    if (element.shape === "polygon") {
      const sides = Math.min(12, Math.max(3, element.polygonSides ?? 6))
      const r = Math.max(2, Math.min(element.width, element.height) / 2 - sw / 2)
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <RegularPolygon
            x={element.width / 2}
            y={element.height / 2}
            sides={sides}
            radius={r}
            fill={element.fill}
            stroke={stroke}
            strokeWidth={sw}
            listening={false}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }
    if (element.shape === "star") {
      const numPoints = Math.min(12, Math.max(3, element.starPoints ?? 5))
      const outer = Math.max(2, Math.min(element.width, element.height) / 2 - sw / 2)
      const inner = outer * 0.45
      return (
        <Group
          ref={ref}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.opacity}
          {...bind}
        >
          <Star
            x={element.width / 2}
            y={element.height / 2}
            numPoints={numPoints}
            innerRadius={inner}
            outerRadius={outer}
            fill={element.fill}
            stroke={stroke}
            strokeWidth={sw}
            listening={false}
          />
          <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
        </Group>
      )
    }
    return (
      <Group
        ref={ref}
        id={element.id}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        opacity={element.opacity}
        {...bind}
      >
        {shapePattern ? (
          <PatternFillRect
            width={element.width}
            height={element.height}
            fill={element.fill}
            patternId={shapePattern.patternId}
            patternColor={shapePattern.patternColor}
            cornerRadius={element.borderRadius ?? 0}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            fill={element.fill}
            stroke={stroke}
            strokeWidth={sw}
            cornerRadius={element.borderRadius ?? 0}
            listening={false}
          />
        )}
        <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
      </Group>
    )
  }),
)

const ImageGroup = memo(
  forwardRef<
    Konva.Group,
    {
      element: ImageElement
      bind: Record<string, unknown>
      locked: boolean
    }
  >(function ImageGroup({ element, bind, locked }, ref) {
    const image = useLoadedImage(element.src)
    return (
      <Group
        ref={ref}
        id={element.id}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        opacity={element.opacity}
        {...bind}
      >
        {image ? (
          <KonvaImage
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            image={image}
            cornerRadius={element.borderRadius ?? 0}
            listening={false}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            fill="#94a3b8"
            listening={false}
          />
        )}
        <ElementHitOverlay width={element.width} height={element.height} locked={locked} />
      </Group>
    )
  }),
)
