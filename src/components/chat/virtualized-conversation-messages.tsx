import { useCallback, useLayoutEffect, useMemo, useRef } from "react"

import { useVirtualizer } from "@tanstack/react-virtual"
import { useStickToBottomContext } from "use-stick-to-bottom"

import { AssistantMessageRowLive } from "@/components/chat/assistant-message-row-live"
import type { ChatStatus } from "@/components/chat/assistant-message-row-live"
import { ChatMessageRow } from "@/components/chat/chat-message-row"
import type { AgentAvatarShape } from "@/components/chat/agent-shape-avatar"
import { getMessageText } from "@/lib/chat-message-utils"
import type { MemorySourceEntry, MockChatItem } from "@/lib/mock-chat-data"

type VirtualizedConversationMessagesProps = {
  messages: MockChatItem[]
  latestAssistantMessageId: string | null
  activeBranch: Record<string, number>
  status: ChatStatus
  chainOfThoughtOpen: Record<string, boolean>
  liveAgentShape: AgentAvatarShape
  llmSuggestions: string[]
  copiedMessageId: string | null
  onBranchChange: (messageId: string, branch: number) => void
  onChainOpenChange: (messageId: string, open: boolean) => void
  onCopy: (messageId: string, text: string) => void
  onSuggestionClick: (text: string) => void
  onOpenMemorySources: (items: MemorySourceEntry[]) => void
}

const ROW_GAP = 32

export function VirtualizedConversationMessages({
  messages,
  latestAssistantMessageId,
  activeBranch,
  status,
  chainOfThoughtOpen,
  liveAgentShape,
  llmSuggestions,
  copiedMessageId,
  onBranchChange,
  onChainOpenChange,
  onCopy,
  onSuggestionClick,
  onOpenMemorySources,
}: VirtualizedConversationMessagesProps) {
  const { scrollRef } = useStickToBottomContext()
  const latestAssistantRowElRef = useRef<HTMLDivElement | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 220,
    getItemKey: (index) => messages[index]?.id ?? index,
    overscan: 8,
    gap: ROW_GAP,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  const streamingAssistantFingerprint = useMemo(() => {
    if (status !== "streaming" || !latestAssistantMessageId) return 0
    const row = messages.find((m) => m.id === latestAssistantMessageId)
    if (!row || row.message.role !== "assistant") return 0
    return getMessageText(row.message).length
  }, [latestAssistantMessageId, messages, status])

  useLayoutEffect(() => {
    const el = latestAssistantRowElRef.current
    if (!el || streamingAssistantFingerprint === 0) return
    rowVirtualizer.measureElement(el)
  }, [rowVirtualizer, streamingAssistantFingerprint])

  const attachRowRef = useCallback(
    (node: HTMLDivElement | null) => {
      rowVirtualizer.measureElement(node)
      if (!node) return
      const idx = Number.parseInt(node.getAttribute("data-index") ?? "-1", 10)
      const row = messages[idx]
      const isLatestAssistant =
        row &&
        row.message.role === "assistant" &&
        row.id === latestAssistantMessageId
      if (isLatestAssistant) {
        latestAssistantRowElRef.current = node
      } else if (latestAssistantRowElRef.current === node) {
        latestAssistantRowElRef.current = null
      }
    },
    [latestAssistantMessageId, messages, rowVirtualizer]
  )

  return (
    <div
      className="relative mx-auto w-full max-w-[768px] px-4 py-4"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {virtualItems.map((virtualItem) => {
        const item = messages[virtualItem.index]
        if (!item) return null

        const msg = item.message
        const branchIndex = activeBranch[item.id] ?? 0
        const branchCount = item.branches?.length ?? 0
        const isLatestAssistantMessage =
          msg.role === "assistant" && item.id === latestAssistantMessageId

        return (
          <div
            key={item.id}
            ref={attachRowRef}
            data-index={virtualItem.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            {msg.role === "assistant" ? (
              <AssistantMessageRowLive
                item={item}
                liveAgentShape={liveAgentShape}
                branchIndex={branchIndex}
                branchCount={branchCount}
                isLatestAssistantMessage={isLatestAssistantMessage}
                status={status}
                chainOpen={
                  chainOfThoughtOpen[item.id] ??
                  (isLatestAssistantMessage && status === "streaming")
                }
                onChainOpenChange={onChainOpenChange}
                onBranchChange={onBranchChange}
                llmSuggestions={llmSuggestions}
                copiedMessageId={copiedMessageId}
                onCopy={onCopy}
                onSuggestionClick={onSuggestionClick}
                onOpenMemorySources={onOpenMemorySources}
              />
            ) : (
              <ChatMessageRow
                item={item}
                branchIndex={branchIndex}
                branchCount={branchCount}
                onBranchChange={onBranchChange}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
