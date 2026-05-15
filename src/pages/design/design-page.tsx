import { useEffect, useRef } from "react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useDesignStore } from "./store/design-store"
import { useDesignDocumentFonts } from "./lib/design-fonts"
import type { DesignDocument } from "./types"
import { DesignChatPanel } from "./design-chat-panel"
import { DesignCanvas, type DesignCanvasHandle } from "./components/canvas/design-canvas"
import { DesignToolbar } from "./components/toolbar/design-toolbar"
import { ExportMenu } from "./components/toolbar/export-menu"
import { PageNavigator } from "./components/page-nav/page-navigator"
import { FloatingDesignProperties } from "./components/properties/floating-design-properties"
import { CanvasLayersControl } from "./components/layers/canvas-layers-control"
// import { DesignTextQuickStrip } from "./components/canvas/design-text-quick-strip"
import { useDesignKeyboardShortcuts } from "./hooks/use-design-keyboard-shortcuts"

interface Props {
  onDocumentChange?: (doc: DesignDocument) => void
}

export function DesignPage({ onDocumentChange }: Props) {
  const canvasRef = useRef<DesignCanvasHandle>(null)
  const document = useDesignStore((s) => s.document)
  useDesignDocumentFonts(document)

  useDesignKeyboardShortcuts()

  useEffect(() => {
    if (document) onDocumentChange?.(document)
  }, [document, onDocumentChange])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
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
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
              <CanvasLayersControl />
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {/* <DesignTextQuickStrip /> — restore when header quick edit returns */}
                <DesignToolbar />
                <ExportMenu canvasRef={canvasRef} />
              </div>
            </header>

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
