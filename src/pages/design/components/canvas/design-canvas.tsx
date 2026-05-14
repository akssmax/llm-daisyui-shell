import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { useShallow } from "zustand/react/shallow"
import { useDesignStore } from "../../store/design-store"
import { DesignKonvaStage } from "../canvas-konva/design-konva-stage"
import { DesignViewportBar } from "./design-viewport-bar"
import { DesignSelectionBar } from "./design-selection-bar"

export interface DesignCanvasHandle {
  getPageElement: () => HTMLDivElement | null
}

export const DesignCanvas = forwardRef<DesignCanvasHandle>((_, ref) => {
  const { document, activePageId, viewport, setViewport, activeTool, setCanvasFitScale, canvasFitRequestTick } =
    useDesignStore(
      useShallow((s) => ({
        document: s.document,
        activePageId: s.activePageId,
        viewport: s.viewport,
        setViewport: s.setViewport,
        activeTool: s.activeTool,
        setCanvasFitScale: s.setCanvasFitScale,
        canvasFitRequestTick: s.canvasFitRequestTick,
      })),
    )

  const measureRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 300 })
  const [fitScale, setFitScale] = useState(1)

  useImperativeHandle(ref, () => ({
    getPageElement: () => measureRef.current,
  }))

  const activePage = document?.pages.find((p) => p.id === activePageId) ?? document?.pages[0]

  /** Stage pixel size only — does not change zoom-to-fit (avoids artboard jumping when the panel resizes). */
  const syncStageSize = useCallback(() => {
    const el = measureRef.current
    if (!el) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    setSize({ w: Math.max(100, cw), h: Math.max(100, ch) })
  }, [])

  /** Recompute fit-to-viewport scale from current container + page dimensions (page change or Fit button). */
  const recomputeFitToPage = useCallback(() => {
    const el = measureRef.current
    if (!el || !activePage) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    setSize({ w: Math.max(100, cw), h: Math.max(100, ch) })
    const pad = 48
    const scaleW = (cw - pad) / activePage.width
    const scaleH = (ch - pad) / activePage.height
    const nextFit = Math.min(scaleW, scaleH, 1)
    setFitScale(nextFit)
    setCanvasFitScale(nextFit)
  }, [activePage, setCanvasFitScale])

  useEffect(() => {
    recomputeFitToPage()
  }, [recomputeFitToPage, activePage?.width, activePage?.height, canvasFitRequestTick])

  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const ro = new ResizeObserver(() => syncStageSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncStageSize])

  const handlePanChange = useCallback(
    (pan: { x: number; y: number }) => {
      setViewport({ panX: pan.x, panY: pan.y })
    },
    [setViewport],
  )

  const handleViewportChange = useCallback(
    (partial: { panX: number; panY: number; userZoom: number }) => {
      setViewport(partial)
    },
    [setViewport],
  )

  if (!document || !activePage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 opacity-30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <p className="text-sm">Ask the AI to create a design, or pick a preset to start</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/30">
      <div className="relative min-h-0 flex-1">
        <DesignSelectionBar />
        <div ref={measureRef} className="absolute inset-0">
          <DesignKonvaStage
            width={size.w}
            height={size.h}
            page={activePage}
            fitScale={fitScale}
            userZoom={viewport.userZoom}
            panX={viewport.panX}
            panY={viewport.panY}
            activeTool={activeTool}
            showGrid={viewport.showGrid}
            snapToGrid={viewport.snapToGrid}
            onPanChange={handlePanChange}
            onViewportChange={handleViewportChange}
          />
        </div>
      </div>
      <DesignViewportBar />
    </div>
  )
})

DesignCanvas.displayName = "DesignCanvas"
