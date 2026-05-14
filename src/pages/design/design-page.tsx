import { useEffect, useRef } from "react"
import { useShallow } from "zustand/react/shallow"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useDesignStore } from "./store/design-store"
import type { DesignDocument } from "./types"
import { DesignChatPanel } from "./design-chat-panel"
import { DesignCanvas, type DesignCanvasHandle } from "./components/canvas/design-canvas"
import { DesignToolbar } from "./components/toolbar/design-toolbar"
import { ExportMenu } from "./components/toolbar/export-menu"
import { PageNavigator } from "./components/page-nav/page-navigator"
import { FloatingDesignProperties } from "./components/properties/floating-design-properties"
import { DesignTextQuickStrip } from "./components/canvas/design-text-quick-strip"

function isTypingFocusedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

interface Props {
  onDocumentChange?: (doc: DesignDocument) => void
}

export function DesignPage({ onDocumentChange }: Props) {
  const canvasRef = useRef<DesignCanvasHandle>(null)
  const document = useDesignStore((s) => s.document)
  const { setActiveTool, setShapeToolVariant, clearSelection } = useDesignStore(
    useShallow((s) => ({
      setActiveTool: s.setActiveTool,
      setShapeToolVariant: s.setShapeToolVariant,
      clearSelection: s.clearSelection,
    })),
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingFocusedTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.code === "Space") {
        if (e.repeat) return
        e.preventDefault()
        setActiveTool("hand")
        return
      }

      if (e.shiftKey) return

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (k === "v") {
        e.preventDefault()
        setActiveTool("select")
        return
      }
      if (k === "h") {
        e.preventDefault()
        setActiveTool("hand")
        return
      }
      if (k === "t") {
        e.preventDefault()
        setActiveTool("text")
        return
      }
      if (k === "r") {
        e.preventDefault()
        setShapeToolVariant("rectangle")
        setActiveTool("shape")
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        clearSelection()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [clearSelection, setActiveTool, setShapeToolVariant])

  useEffect(() => {
    if (document) onDocumentChange?.(document)
  }, [document, onDocumentChange])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger className="md:hidden" />
        <Separator orientation="vertical" className="mr-1 h-4 md:hidden" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {document?.title ?? "Design"}
          </p>
          {document && (
            <span className="truncate text-xs text-muted-foreground capitalize">
              · {document.type.replace("-", " ")}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DesignTextQuickStrip />
          <DesignToolbar />
          <ExportMenu canvasRef={canvasRef} />
        </div>
      </header>

      {/* Body */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1 overflow-hidden"
      >
        {/* Left: Chat panel — pixel-pinned like Playground settings panel */}
        <ResizablePanel
          id="design-chat-panel"
          defaultSize="360px"
          minSize="300px"
          maxSize="480px"
          groupResizeBehavior="preserve-pixel-size"
          className="min-w-[300px] overflow-hidden"
        >
          <DesignChatPanel />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Canvas; properties float over the canvas when one element is selected */}
        <ResizablePanel
          id="design-canvas-panel"
          defaultSize={70}
          minSize="400px"
          className="min-w-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <DesignCanvas ref={canvasRef} />
              <FloatingDesignProperties />
            </div>
            <PageNavigator />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
