import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Group, Layer, Rect, Stage, Transformer, Line, Ellipse, Arrow } from "react-konva"
import type Konva from "konva"
import { nanoid } from "nanoid"
import { useShallow } from "zustand/react/shallow"
import type { DesignElement, DesignPage, ShapeElement, SilhouetteElement, TextElement, ShapeKind } from "../../types"
import { useDesignStore, type ActiveTool } from "../../store/design-store"
import { DesignElementNode } from "./design-element-node"
import { PatternFillRect } from "./pattern-fill-rect"
import { snapToDesignGrid } from "../../lib/design-snap"
import { fontFamilyForKonva } from "../../lib/design-fonts"
import { htmlTextareaFontWeight } from "../../lib/design-text-style"
import { safePageElements } from "../../lib/safe-page-elements"

const MIN_SHAPE = 8

function buildShapeFromBox(
  variant: ShapeKind,
  box: { id: string; x: number; y: number; width: number; height: number; zIndex: number },
): ShapeElement {
  const accent = "#6366F1"
  const { id, x, y, width, height, zIndex } = box
  const base = {
    kind: "shape" as const,
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    opacity: 1,
  }
  switch (variant) {
    case "rectangle":
      return { ...base, shape: "rectangle", fill: accent, borderRadius: 8, strokeWidth: 0 }
    case "ellipse":
      return { ...base, shape: "ellipse", fill: accent, strokeWidth: 0 }
    case "triangle":
      return { ...base, shape: "triangle", fill: accent, strokeWidth: 0 }
    case "line":
      return { ...base, shape: "line", fill: "transparent", stroke: accent, strokeWidth: 4 }
    case "arrow":
      return { ...base, shape: "arrow", fill: "transparent", stroke: accent, strokeWidth: 3 }
    case "polygon":
      return { ...base, shape: "polygon", fill: accent, strokeWidth: 0, polygonSides: 6 }
    case "star":
      return { ...base, shape: "star", fill: accent, strokeWidth: 0, starPoints: 5 }
  }
}

/** Tools that place new content; clicking an existing element should still select it (Figma/Canva-style). */
const CREATION_TOOLS: ActiveTool[] = ["text", "shape", "image", "icon", "silhouette"]

function clientRectForNode(stage: Konva.Stage, node: Konva.Group) {
  const container = stage.container()
  const br = container.getBoundingClientRect()
  const rect = node.getClientRect({ relativeTo: stage })
  const sx = br.width / stage.width()
  const sy = br.height / stage.height()
  return {
    left: br.left + rect.x * sx,
    top: br.top + rect.y * sy,
    width: Math.max(8, rect.width * sx),
    height: Math.max(8, rect.height * sy),
  }
}

const USER_ZOOM_MIN = 0.25
const USER_ZOOM_MAX = 2

type Props = {
  width: number
  height: number
  page: DesignPage
  fitScale: number
  userZoom: number
  panX: number
  panY: number
  activeTool: ActiveTool
  showGrid: boolean
  snapToGrid: boolean
  onPanChange: (pan: { x: number; y: number }) => void
  onViewportChange: (partial: { panX: number; panY: number; userZoom: number }) => void
}

export function DesignKonvaStage({
  width,
  height,
  page,
  fitScale,
  userZoom,
  panX,
  panY,
  activeTool,
  showGrid,
  snapToGrid,
  onPanChange,
  onViewportChange,
}: Props) {
  const {
    selection,
    selectElements,
    clearSelection,
    applyPatches,
    pendingDesignImage,
    setPendingDesignImage,
    setActiveTool,
    shapeToolVariant,
    silhouetteToolShape,
    fontEpoch,
  } =
    useDesignStore(
    useShallow((s) => ({
      selection: s.selection,
      selectElements: s.selectElements,
      clearSelection: s.clearSelection,
      applyPatches: s.applyPatches,
      pendingDesignImage: s.pendingDesignImage,
      setPendingDesignImage: s.setPendingDesignImage,
      setActiveTool: s.setActiveTool,
      shapeToolVariant: s.shapeToolVariant,
      silhouetteToolShape: s.silhouetteToolShape,
      fontEpoch: s.fontEpoch,
    })),
  )

  const transformerRef = useRef<Konva.Transformer>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const skipCommitOnBlurRef = useRef(false)
  const nodeRefs = useRef<Map<string, Konva.Group>>(new Map())
  const [textEditId, setTextEditId] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState("")
  const [textBox, setTextBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [draftShape, setDraftShape] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [isViewportPanning, setIsViewportPanning] = useState(false)
  const draftStart = useRef<{ x: number; y: number } | null>(null)
  const panSessionRef = useRef<{ sx: number; sy: number; pan0x: number; pan0y: number } | null>(null)
  const panCleanupRef = useRef<(() => void) | null>(null)

  const totalScale = Math.max(0.05, fitScale * userZoom)
  const centerX = (width - page.width * totalScale) / 2
  const centerY = (height - page.height * totalScale) / 2

  const pageElements = useMemo(() => safePageElements(page), [page])
  const sorted = useMemo(() => [...pageElements].sort((a, b) => a.zIndex - b.zIndex), [pageElements])

  const pageBg =
    page.backgroundColor && page.backgroundColor !== "transparent" ? page.backgroundColor : "#FFFFFF"

  const selectedId = selection.elementIds[0] ?? null
  const isHand = activeTool === "hand"
  const interactionDisabled = isHand

  const selectedIdRef = useRef<string | null>(selectedId)
  selectedIdRef.current = selectedId

  const attachTransformerToSelection = useCallback(() => {
    const tr = transformerRef.current
    if (!tr) return
    if (!selectedId || isHand || textEditId || activeTool !== "select") {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const n = nodeRefs.current.get(selectedId)
    if (n) {
      tr.nodes([n])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
    }
  }, [activeTool, isHand, selectedId, textEditId])

  const registerRef = useCallback(
    (id: string, node: Konva.Group | null) => {
      if (node) nodeRefs.current.set(id, node)
      else nodeRefs.current.delete(id)
      // Ref callbacks can run after the transformer effect; re-attach once the Konva node exists.
      if (id === selectedIdRef.current) {
        queueMicrotask(() => {
          if (id !== selectedIdRef.current) return
          attachTransformerToSelection()
        })
      }
    },
    [attachTransformerToSelection],
  )

  useLayoutEffect(() => {
    attachTransformerToSelection()
  }, [attachTransformerToSelection, sorted, page.id, fontEpoch])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.getLayers().forEach((layer) => layer.batchDraw())
  }, [fontEpoch])

  useEffect(() => {
    if (activeTool !== "image" || !pendingDesignImage) return
    const src = pendingDesignImage
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const maxW = page.width * 0.6
      const maxH = page.height * 0.6
      let w = img.naturalWidth
      let h = img.naturalHeight
      const r = Math.min(maxW / w, maxH / h, 1)
      w = Math.max(MIN_SHAPE, Math.round(w * r))
      h = Math.max(MIN_SHAPE, Math.round(h * r))
      const x = snapToDesignGrid(Math.round((page.width - w) / 2), snapToGrid)
      const y = snapToDesignGrid(Math.round((page.height - h) / 2), snapToGrid)
      const element: DesignElement = {
        kind: "image",
        id: nanoid(8),
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        zIndex: Math.max(0, ...pageElements.map((e) => e.zIndex)) + 1,
        opacity: 1,
        src,
        objectFit: "cover",
      }
      applyPatches([{ op: "create_element", pageId: page.id, element }], { clearSelection: false })
      selectElements([element.id], page.id)
      setPendingDesignImage(null)
      setActiveTool("select")
    }
    img.onerror = () => {
      setPendingDesignImage(null)
      setActiveTool("select")
    }
    img.src = src
  }, [
    activeTool,
    pendingDesignImage,
    pageElements,
    page.height,
    page.id,
    page.width,
    applyPatches,
    selectElements,
    setActiveTool,
    snapToGrid,
  ])

  const pagePointFromStage = useCallback(
    (stage: Konva.Stage) => {
      const pos = stage.getPointerPosition()
      if (!pos) return null
      const cx = (width - page.width * totalScale) / 2
      const cy = (height - page.height * totalScale) / 2
      const lx = (pos.x - panX - cx) / totalScale
      const ly = (pos.y - panY - cy) / totalScale
      return { x: lx, y: ly }
    },
    [height, page.height, page.width, panX, panY, totalScale, width],
  )

  const startPanSession = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current
      if (!stage) return
      panCleanupRef.current?.()
      const rect = stage.container().getBoundingClientRect()
      const scaleX = stage.width() / rect.width
      const scaleY = stage.height() / rect.height
      const x = (clientX - rect.left) * scaleX
      const y = (clientY - rect.top) * scaleY
      panSessionRef.current = { sx: x, sy: y, pan0x: panX, pan0y: panY }

      const onMove = () => {
        const st = stageRef.current
        const sess = panSessionRef.current
        if (!st || !sess) return
        const pos = st.getPointerPosition()
        if (!pos) return
        onPanChange({ x: sess.pan0x + (pos.x - sess.sx), y: sess.pan0y + (pos.y - sess.sy) })
      }

      const onTouchMove = (ev: TouchEvent) => {
        const st = stageRef.current
        const sess = panSessionRef.current
        if (!st || !sess) return
        const t = ev.touches[0]
        if (!t) return
        const r = st.container().getBoundingClientRect()
        const sx = st.width() / r.width
        const sy = st.height() / r.height
        const px = (t.clientX - r.left) * sx
        const py = (t.clientY - r.top) * sy
        onPanChange({ x: sess.pan0x + (px - sess.sx), y: sess.pan0y + (py - sess.sy) })
      }

      const onUp = () => {
        panSessionRef.current = null
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        window.removeEventListener("touchmove", onTouchMove)
        window.removeEventListener("touchend", onUp)
        window.removeEventListener("touchcancel", onUp)
        panCleanupRef.current = null
        setIsViewportPanning(false)
      }

      panCleanupRef.current = onUp
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
      window.addEventListener("touchmove", onTouchMove, { passive: false })
      window.addEventListener("touchend", onUp)
      window.addEventListener("touchcancel", onUp)
      setIsViewportPanning(true)
    },
    [onPanChange, panX, panY],
  )

  useEffect(() => () => panCleanupRef.current?.(), [])

  useLayoutEffect(() => {
    const el = stageRef.current?.container()
    if (!el) return
    const fn = (ev: WheelEvent) => {
      ev.preventDefault()
    }
    el.addEventListener("wheel", fn, { passive: false })
    return () => el.removeEventListener("wheel", fn)
  }, [width, height])

  useLayoutEffect(() => {
    const el = stageRef.current?.container()
    if (!el) return
    if (isHand) {
      el.style.cursor = isViewportPanning ? "grabbing" : "grab"
    } else {
      el.style.cursor = ""
    }
    return () => {
      el.style.cursor = ""
    }
  }, [isHand, isViewportPanning, width, height])

  const onPanCaptureDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isHand) return
      if ("button" in e.evt && e.evt.button !== 0) return
      if ("touches" in e.evt && e.evt.touches.length !== 1) return
      e.evt.preventDefault()
      e.cancelBubble = true
      const clientX = "touches" in e.evt ? e.evt.touches[0]?.clientX ?? 0 : e.evt.clientX
      const clientY = "touches" in e.evt ? e.evt.touches[0]?.clientY ?? 0 : e.evt.clientY
      startPanSession(clientX, clientY)
    },
    [isHand, startPanSession],
  )

  const onWheelZoom = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = e.target.getStage()
      if (!stage) return
      const pos = stage.getPointerPosition()
      if (!pos) return

      const delta = e.evt.deltaY
      const factor = Math.exp(-delta * 0.0015)
      const nextZoom = Math.min(USER_ZOOM_MAX, Math.max(USER_ZOOM_MIN, userZoom * factor))
      if (nextZoom === userZoom) return

      const ts0 = Math.max(0.05, fitScale * userZoom)
      const cx0 = (width - page.width * ts0) / 2
      const cy0 = (height - page.height * ts0) / 2
      const pageX = (pos.x - panX - cx0) / ts0
      const pageY = (pos.y - panY - cy0) / ts0

      const ts1 = Math.max(0.05, fitScale * nextZoom)
      const cx1 = (width - page.width * ts1) / 2
      const cy1 = (height - page.height * ts1) / 2
      const nextPanX = pos.x - cx1 - pageX * ts1
      const nextPanY = pos.y - cy1 - pageY * ts1

      onViewportChange({ userZoom: nextZoom, panX: nextPanX, panY: nextPanY })
    },
    [fitScale, height, onViewportChange, page.height, page.width, panX, panY, userZoom, width],
  )

  const handleSelect = useCallback(
    (elementId: string, pageId: string) => {
      if (activeTool === "hand") return
      if (CREATION_TOOLS.includes(activeTool)) {
        setActiveTool("select")
      }
      selectElements([elementId], pageId)
    },
    [activeTool, selectElements, setActiveTool],
  )

  const handleDragEnd = useCallback(
    (elementId: string, x: number, y: number) => {
      const sx = snapToDesignGrid(x, snapToGrid)
      const sy = snapToDesignGrid(y, snapToGrid)
      applyPatches(
        [{ op: "update_element", pageId: page.id, elementId, patch: { x: sx, y: sy } }],
        { clearSelection: false },
      )
    },
    [applyPatches, page.id, snapToGrid],
  )

  const handleTransformEnd = useCallback(
    (
      elementId: string,
      attrs: { x: number; y: number; width: number; height: number; rotation: number },
    ) => {
      applyPatches(
        [
          {
            op: "update_element",
            pageId: page.id,
            elementId,
            patch: {
              x: snapToDesignGrid(attrs.x, snapToGrid),
              y: snapToDesignGrid(attrs.y, snapToGrid),
              width: snapToDesignGrid(attrs.width, snapToGrid),
              height: snapToDesignGrid(attrs.height, snapToGrid),
              rotation: attrs.rotation,
            },
          },
        ],
        { clearSelection: false },
      )
    },
    [applyPatches, page.id, snapToGrid],
  )

  const cancelTextEdit = useCallback(() => {
    skipCommitOnBlurRef.current = true
    setTextEditId(null)
    setTextDraft("")
    setTextBox(null)
  }, [])

  const commitTextEdit = useCallback(() => {
    if (!textEditId) return
    const el = pageElements.find((e) => e.id === textEditId)
    if (!el || el.kind !== "text") {
      cancelTextEdit()
      return
    }
    if (textDraft !== el.content) {
      applyPatches(
        [{ op: "update_element", pageId: page.id, elementId: textEditId, patch: { content: textDraft } }],
        { clearSelection: false },
      )
    }
    skipCommitOnBlurRef.current = true
    setTextEditId(null)
    setTextDraft("")
    setTextBox(null)
  }, [applyPatches, cancelTextEdit, pageElements, page.id, textDraft, textEditId])

  const handleTextDblClick = useCallback(
    (elementId: string, pageId: string) => {
      if (activeTool === "hand" || pageId !== page.id) return
      const el = pageElements.find((e) => e.id === elementId)
      if (!el || el.kind !== "text" || el.locked) return
      if (CREATION_TOOLS.includes(activeTool)) {
        setActiveTool("select")
      }
      skipCommitOnBlurRef.current = false
      setTextEditId(elementId)
      setTextDraft(el.content)
    },
    [activeTool, pageElements, page.id, setActiveTool],
  )

  useLayoutEffect(() => {
    if (!textEditId) {
      setTextBox(null)
      return
    }
    const stage = stageRef.current
    const node = nodeRefs.current.get(textEditId)
    if (!stage || !node) return
    setTextBox(clientRectForNode(stage, node))
  }, [textEditId, width, height, panX, panY, totalScale, centerX, centerY, page.width, page.height, sorted])

  useEffect(() => {
    if (!textEditId) return
    const onResize = () => {
      const stage = stageRef.current
      const node = nodeRefs.current.get(textEditId)
      if (stage && node) setTextBox(clientRectForNode(stage, node))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [textEditId])

  useEffect(() => {
    if (!textEditId) return
    const id = requestAnimationFrame(() => {
      textAreaRef.current?.focus()
      textAreaRef.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [textEditId])

  useEffect(() => {
    if (!textEditId) return
    if (selectedId !== textEditId) cancelTextEdit()
  }, [cancelTextEdit, selectedId, textEditId])

  useEffect(() => {
    if (!textEditId) return
    if (!pageElements.some((e) => e.id === textEditId)) cancelTextEdit()
  }, [cancelTextEdit, pageElements, textEditId])

  const editingText = useMemo(() => {
    if (!textEditId) return undefined
    const el = pageElements.find((e) => e.id === textEditId)
    return el?.kind === "text" ? el : undefined
  }, [pageElements, textEditId])

  const onStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = e.target.getStage()
      if (!stage) return
      const name = e.target.name()
      if (name === "stage-hit" && activeTool === "select") {
        clearSelection()
        return
      }
      if (name !== "page-bg") return
      const pt = pagePointFromStage(stage)
      if (!pt) return
      const lx = pt.x
      const ly = pt.y
      if (lx < 0 || ly < 0 || lx > page.width || ly > page.height) return

      if (activeTool === "select") {
        clearSelection()
        return
      }

      if (activeTool === "shape") {
        draftStart.current = { x: lx, y: ly }
        setDraftShape({ x: lx, y: ly, w: 0, h: 0 })
      }
      if (activeTool === "text") {
        const z = Math.max(0, ...pageElements.map((el) => el.zIndex)) + 1
        const tw = snapToDesignGrid(280, snapToGrid)
        const th = snapToDesignGrid(48, snapToGrid)
        const tx = snapToDesignGrid(lx - tw / 2, snapToGrid)
        const ty = snapToDesignGrid(ly - th / 2, snapToGrid)
        const textEl: TextElement = {
          kind: "text",
          id: nanoid(8),
          x: Math.max(0, tx),
          y: Math.max(0, ty),
          width: tw,
          height: th,
          rotation: 0,
          zIndex: z,
          opacity: 1,
          content: "Double-click to edit",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 18,
          fontWeight: "normal",
          fontStyle: "normal",
          color: "#0F172A",
          textAlign: "left",
          lineHeight: 1.4,
        }
        applyPatches([{ op: "create_element", pageId: page.id, element: textEl }], { clearSelection: false })
        selectElements([textEl.id], page.id)
        setActiveTool("select")
        return
      }
      if (activeTool === "icon") {
        const z = Math.max(0, ...pageElements.map((el) => el.zIndex)) + 1
        const size = snapToDesignGrid(96, snapToGrid)
        const iconEl = {
          kind: "icon" as const,
          id: nanoid(8),
          x: snapToDesignGrid(lx - size / 2, snapToGrid),
          y: snapToDesignGrid(ly - size / 2, snapToGrid),
          width: size,
          height: size,
          rotation: 0,
          zIndex: z,
          opacity: 1,
          iconName: "sparkles",
          color: "#6366F1",
        }
        applyPatches([{ op: "create_element", pageId: page.id, element: iconEl }], { clearSelection: false })
        selectElements([iconEl.id], page.id)
        setActiveTool("select")
        return
      }
      if (activeTool === "silhouette") {
        const z = Math.max(0, ...pageElements.map((el) => el.zIndex)) + 1
        const size = snapToDesignGrid(120, snapToGrid)
        const silhouetteEl: SilhouetteElement = {
          kind: "silhouette",
          id: nanoid(8),
          x: snapToDesignGrid(Math.max(0, lx - size / 2), snapToGrid),
          y: snapToDesignGrid(Math.max(0, ly - size / 2), snapToGrid),
          width: size,
          height: size,
          rotation: 0,
          zIndex: z,
          opacity: 1,
          shapeName: silhouetteToolShape,
          color: "#6366F1",
        }
        applyPatches([{ op: "create_element", pageId: page.id, element: silhouetteEl }], { clearSelection: false })
        selectElements([silhouetteEl.id], page.id)
        setActiveTool("select")
      }
    },
    [
      activeTool,
      applyPatches,
      clearSelection,
      pageElements,
      page.height,
      page.id,
      page.width,
      pagePointFromStage,
      selectElements,
      setActiveTool,
      silhouetteToolShape,
      snapToGrid,
    ],
  )

  const onStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (activeTool !== "shape" || !draftStart.current) return
      const stage = e.target.getStage()
      if (!stage) return
      const pt = pagePointFromStage(stage)
      if (!pt) return
      const lx = pt.x
      const ly = pt.y
      const x0 = draftStart.current.x
      const y0 = draftStart.current.y
      setDraftShape({
        x: Math.min(x0, lx),
        y: Math.min(y0, ly),
        w: Math.abs(lx - x0),
        h: Math.abs(ly - y0),
      })
    },
    [activeTool, pagePointFromStage],
  )

  const onStageMouseUp = useCallback(() => {
    if (activeTool !== "shape" || !draftShape || !draftStart.current) {
      draftStart.current = null
      setDraftShape(null)
      return
    }
    const { x, y, w, h } = draftShape
    draftStart.current = null
    setDraftShape(null)
    const variant = shapeToolVariant
    if (variant === "line" || variant === "arrow") {
      if (Math.hypot(w, h) < MIN_SHAPE) return
    } else {
      if (w < MIN_SHAPE || h < MIN_SHAPE) return
    }
    const z = Math.max(0, ...pageElements.map((el) => el.zIndex)) + 1
    const width =
      variant === "line" || variant === "arrow"
        ? snapToDesignGrid(Math.max(1, w), snapToGrid)
        : snapToDesignGrid(Math.max(MIN_SHAPE, w), snapToGrid)
    const height =
      variant === "line" || variant === "arrow"
        ? snapToDesignGrid(Math.max(1, h), snapToGrid)
        : snapToDesignGrid(Math.max(MIN_SHAPE, h), snapToGrid)
    const shape = buildShapeFromBox(variant, {
      id: nanoid(8),
      x: snapToDesignGrid(x, snapToGrid),
      y: snapToDesignGrid(y, snapToGrid),
      width,
      height,
      zIndex: z,
    })
    applyPatches([{ op: "create_element", pageId: page.id, element: shape }], { clearSelection: false })
    selectElements([shape.id], page.id)
    setActiveTool("select")
  }, [activeTool, applyPatches, draftShape, pageElements, page.id, selectElements, setActiveTool, shapeToolVariant, snapToGrid])

  const gridLines = useMemo(() => {
    if (!showGrid) return null
    const lines: React.ReactNode[] = []
    let k = 0
    const g = 32
    for (let x = 0; x <= page.width; x += g) {
      lines.push(
        <Rect key={`gv-${k++}`} x={x} y={0} width={1} height={page.height} fill="#00000012" listening={false} />,
      )
    }
    for (let y = 0; y <= page.height; y += g) {
      lines.push(
        <Rect key={`gh-${k++}`} x={0} y={y} width={page.width} height={1} fill="#00000012" listening={false} />,
      )
    }
    return lines
  }, [page.height, page.width, showGrid])

  return (
    <>
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={onStageMouseDown}
      onMouseMove={onStageMouseMove}
      onMouseUp={onStageMouseUp}
      onTouchStart={onStageMouseDown}
      onTouchMove={onStageMouseMove}
      onTouchEnd={onStageMouseUp}
      onWheel={onWheelZoom}
    >
      <Layer>
        <Rect
          name="stage-hit"
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(250,250,250,0.01)"
          listening={!isHand}
        />
        <Group x={panX} y={panY}>
          <Group x={centerX} y={centerY} scaleX={totalScale} scaleY={totalScale}>
            <Rect
              name="page-bg"
              x={0}
              y={0}
              width={page.width}
              height={page.height}
              fill={pageBg}
              stroke="#64748b55"
              strokeWidth={1}
              listening={!isHand}
            />
            {page.backgroundPattern ? (
              <PatternFillRect
                width={page.width}
                height={page.height}
                fill={page.backgroundPattern.backgroundColor ?? pageBg}
                patternId={page.backgroundPattern.patternId}
                patternColor={page.backgroundPattern.color}
                opacity={page.backgroundPattern.opacity ?? 1}
              />
            ) : null}
            {gridLines}
            {/* Elements are clipped to artboard bounds so out-of-range AI output never overflows. */}
            <Group clipX={0} clipY={0} clipWidth={page.width} clipHeight={page.height}>
              {sorted.map((el) => (
                <DesignElementNode
                  key={el.id}
                  ref={(node) => registerRef(el.id, node)}
                  element={el}
                  pageId={page.id}
                  interactionDisabled={interactionDisabled}
                  onSelect={handleSelect}
                  onTransformEnd={handleTransformEnd}
                  onDragEnd={handleDragEnd}
                  onTextDblClick={handleTextDblClick}
                />
              ))}
            </Group>
            {draftShape && draftShape.w > 0 && draftShape.h > 0 && activeTool === "shape" ? (
              shapeToolVariant === "ellipse" ? (
                <Ellipse
                  x={draftShape.x + draftShape.w / 2}
                  y={draftShape.y + draftShape.h / 2}
                  radiusX={Math.max(1, draftShape.w / 2)}
                  radiusY={Math.max(1, draftShape.h / 2)}
                  stroke="#6366F1"
                  dash={[6, 4]}
                  strokeWidth={2}
                  listening={false}
                />
              ) : shapeToolVariant === "line" ? (
                <Line
                  points={[draftShape.x, draftShape.y, draftShape.x + draftShape.w, draftShape.y + draftShape.h]}
                  stroke="#6366F1"
                  dash={[6, 4]}
                  strokeWidth={2}
                  listening={false}
                />
              ) : shapeToolVariant === "arrow" ? (
                <Arrow
                  points={[draftShape.x, draftShape.y, draftShape.x + draftShape.w, draftShape.y + draftShape.h]}
                  stroke="#6366F1"
                  fill="#6366F1"
                  dash={[6, 4]}
                  strokeWidth={2}
                  pointerLength={Math.min(16, Math.max(8, Math.min(draftShape.w, draftShape.h) / 3))}
                  pointerWidth={Math.min(12, Math.max(6, Math.min(draftShape.w, draftShape.h) / 4))}
                  listening={false}
                />
              ) : (
                <Rect
                  x={draftShape.x}
                  y={draftShape.y}
                  width={draftShape.w}
                  height={draftShape.h}
                  stroke="#6366F1"
                  dash={[6, 4]}
                  strokeWidth={2}
                  listening={false}
                />
              )
            ) : null}
            {!isHand && selectedId && activeTool === "select" && !textEditId ? (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                padding={6}
                borderStroke="#3b82f6"
                borderStrokeWidth={2.5}
                anchorStroke="#3b82f6"
                anchorFill="#ffffff"
                anchorSize={11}
                anchorCornerRadius={3}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < MIN_SHAPE || newBox.height < MIN_SHAPE) return oldBox
                  return newBox
                }}
              />
            ) : null}
          </Group>
        </Group>
        <Rect
          name="pan-capture"
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(0,0,0,0.001)"
          listening={isHand}
          onMouseDown={onPanCaptureDown}
          onTouchStart={onPanCaptureDown}
        />
      </Layer>
    </Stage>
    {editingText && textBox
      ? createPortal(
          <textarea
            ref={textAreaRef}
            aria-label="Edit text on canvas"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                cancelTextEdit()
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                commitTextEdit()
              }
            }}
            onBlur={() => {
              if (skipCommitOnBlurRef.current) {
                skipCommitOnBlurRef.current = false
                return
              }
              commitTextEdit()
            }}
            style={{
              position: "fixed",
              left: textBox.left,
              top: textBox.top,
              width: textBox.width,
              height: textBox.height,
              zIndex: 10000,
              margin: 0,
              padding: 0,
              resize: "none",
              overflow: "hidden",
              boxSizing: "border-box",
              border: "2px solid #3b82f6",
              borderRadius: 2,
              background: "rgba(255,255,255,0.96)",
              fontFamily: fontFamilyForKonva(editingText.fontFamily),
              fontSize: editingText.fontSize,
              fontWeight: htmlTextareaFontWeight(editingText.fontWeight),
              fontStyle: editingText.fontStyle,
              color: editingText.color,
              textAlign: editingText.textAlign as "left" | "center" | "right",
              lineHeight: `${editingText.lineHeight * editingText.fontSize}px`,
              whiteSpace: "pre-wrap",
              outline: "none",
            }}
          />,
          document.body,
        )
      : null}
    </>
  )
}
