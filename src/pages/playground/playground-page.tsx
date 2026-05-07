import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useIsMobile } from "@/hooks/use-mobile"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { PlaygroundChatPreview } from "@/pages/playground/playground-chat-preview"
import { PlaygroundSettingsPanel } from "@/pages/playground/playground-settings-panel"
import {
  DEFAULT_PLAYGROUND_UI_CONFIG,
  type PlaygroundUiConfig,
} from "@/pages/playground/playground-ui-config"

export function PlaygroundPage() {
  const [config, setConfig] = useState<PlaygroundUiConfig>(DEFAULT_PLAYGROUND_UI_CONFIG)
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2 rounded-md bg-accent p-1.5 text-accent-foreground">
          <SlidersHorizontal className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">Playground</p>
          <p className="truncate text-xs text-muted-foreground">
            Mock preview — settings do not affect New Chat yet.
          </p>
        </div>
      </header>

      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="h-[44svh] min-h-[280px] shrink-0 overflow-hidden border-b border-border">
            <PlaygroundSettingsPanel
              config={config}
              setConfig={setConfig}
              className="h-full min-w-0 border-r-0"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PlaygroundChatPreview config={config} />
          </div>
        </div>
      ) : (
        <ResizablePanelGroup
          orientation="horizontal"
          autoSaveId="playground-layout-v2"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <ResizablePanel
            id="playground-settings-panel"
            order={1}
            defaultSize="360px"
            minSize="320px"
            maxSize="400px"
            groupResizeBehavior="preserve-pixel-size"
            className="min-w-[320px] max-w-[400px] overflow-hidden"
          >
            <PlaygroundSettingsPanel
              config={config}
              setConfig={setConfig}
              className="h-full min-w-[320px] max-w-[400px]"
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="playground-preview-panel"
            order={2}
            defaultSize={70}
            minSize="480px"
            className="min-w-0 overflow-hidden"
          >
            <PlaygroundChatPreview config={config} />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
