import { memo, useCallback, useMemo } from "react"
import type { UIMessage } from "ai"

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought"
import {
  Message,
  MessageActions,
  MessageAction,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
} from "@/components/ai-elements/message"
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { AgentShapeAvatar } from "@/components/chat/agent-shape-avatar"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { buildUnifiedTraceSteps } from "@/lib/chat-trace-steps"
import { getMessageText } from "@/lib/chat-message-utils"
import type { MemorySourceEntry, MockChatItem } from "@/lib/mock-chat-data"
import type { AgentAvatarShape } from "@/components/chat/agent-shape-avatar"
import { Bot, Check, Copy, Sparkles, BookOpen, ThumbsDown, ThumbsUp } from "lucide-react"

export type ChatStatus = "ready" | "submitted" | "streaming" | "error"

export type AssistantMessageRowLiveProps = {
  item: MockChatItem
  liveAgentShape: AgentAvatarShape
  branchIndex: number
  branchCount: number
  isLatestAssistantMessage: boolean
  status: ChatStatus
  chainOpen: boolean
  onChainOpenChange: (messageId: string, open: boolean) => void
  onBranchChange: (messageId: string, branch: number) => void
  llmSuggestions: string[]
  copiedMessageId: string | null
  onCopy: (messageId: string, text: string) => void
  onSuggestionClick: (text: string) => void
  onOpenMemorySources: (items: MemorySourceEntry[]) => void
}

function AssistantMessageRowLiveInner({
  item,
  liveAgentShape,
  branchIndex,
  branchCount,
  isLatestAssistantMessage,
  status,
  chainOpen,
  onChainOpenChange,
  onBranchChange,
  onCopy,
  onSuggestionClick,
  llmSuggestions,
  copiedMessageId,
  onOpenMemorySources,
}: AssistantMessageRowLiveProps) {
  const msg = item.message
  const meta = item.meta

  const assistantPlainText = getMessageText(msg)
  const hasAssistantText = Boolean(assistantPlainText.trim())
  const isStreaming = isLatestAssistantMessage && status === "streaming"

  const reasoningSnippet = meta?.reasoning?.content ?? ""

  const sourcesFingerprint = useMemo(() => {
    const titles = [
      ...(meta?.sources?.map((source) => source.title) ?? []),
      ...(meta?.memorySources?.map((source) => source.title) ?? []),
    ]
    return Array.from(new Set(titles)).join("\u0001")
  }, [meta?.memorySources, meta?.sources])

  const traceSteps = useMemo(() => {
    const uniqueSourceTitles = sourcesFingerprint
      ? sourcesFingerprint.split("\u0001")
      : []
    return buildUnifiedTraceSteps({
      hasAssistantText,
      isStreaming,
      itemId: item.id,
      reasoning: reasoningSnippet,
      sources: uniqueSourceTitles,
      tools: meta?.tools,
    })
  }, [hasAssistantText, isStreaming, item.id, meta?.tools, reasoningSnippet, sourcesFingerprint])

  const uniqueSourceTitles = useMemo(() => {
    if (!sourcesFingerprint) return [] as string[]
    return sourcesFingerprint.split("\u0001")
  }, [sourcesFingerprint])

  const handleBranchChange = useCallback(
    (next: number) => {
      onBranchChange(item.id, next)
    },
    [item.id, onBranchChange]
  )

  const handleChainOpen = useCallback(
    (open: boolean) => {
      onChainOpenChange(item.id, open)
    },
    [item.id, onChainOpenChange]
  )

  const handleCopy = useCallback(() => {
    const text = getMessageText(msg)
    if (!text) return
    void onCopy(item.id, text)
  }, [item.id, msg, onCopy])

  const handleSources = useCallback(() => {
    onOpenMemorySources(meta?.memorySources ?? [])
  }, [meta?.memorySources, onOpenMemorySources])

  const showFeedbackBar = !isLatestAssistantMessage || status !== "streaming"

  const messageBody = (
    <div className="space-y-2">
      {(() => {
        if (traceSteps.length === 0) return null
        return (
          <ChainOfThought
            defaultOpen={isLatestAssistantMessage && status === "streaming"}
            open={chainOpen}
            onOpenChange={handleChainOpen}
          >
            <ChainOfThoughtHeader>
              {isLatestAssistantMessage && status === "streaming" ? (
                <Shimmer
                  as="span"
                  className="text-sm text-muted-foreground"
                  duration={2.2}
                >
                  Thinking...
                </Shimmer>
              ) : typeof meta?.reasoning?.durationSeconds === "number" ? (
                `Thought for ${Math.max(1, meta.reasoning.durationSeconds)} seconds`
              ) : uniqueSourceTitles.length > 0 ? (
                `Generated using ${uniqueSourceTitles.length} source${uniqueSourceTitles.length === 1 ? "" : "s"}`
              ) : (
                "Chain of Thought"
              )}
            </ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              {traceSteps.map((step) => (
                <ChainOfThoughtStep
                  key={step.id}
                  label={step.label}
                  description={step.description}
                  status={step.status}
                >
                  {step.sources?.length ? (
                    <ChainOfThoughtSearchResults>
                      {step.sources.map((source) => (
                        <ChainOfThoughtSearchResult key={`${step.id}-${source}`}>
                          {source}
                        </ChainOfThoughtSearchResult>
                      ))}
                    </ChainOfThoughtSearchResults>
                  ) : null}
                </ChainOfThoughtStep>
              ))}
            </ChainOfThoughtContent>
          </ChainOfThought>
        )
      })()}

      <MessageContent>
        <MarkdownRenderer markdown={assistantPlainText} />
      </MessageContent>

      {meta?.citations?.length ? (
        <InlineCitation>
          {meta.citations.map((c) => (
            <InlineCitationCard key={c.href}>
              <InlineCitationCardTrigger sources={[c.href]} />
              <InlineCitationCardBody>
                <InlineCitationSource
                  title={c.label}
                  url={c.href}
                  description="Citation"
                />
              </InlineCitationCardBody>
            </InlineCitationCard>
          ))}
        </InlineCitation>
      ) : null}

      {showFeedbackBar ? (
        <MessageActions className="w-fit items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/65">
          <MessageAction
            tooltip="Copy message"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            onClick={handleCopy}
          >
            {copiedMessageId === item.id ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </MessageAction>
          <MessageAction
            tooltip="Helpful"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg text-muted-foreground hover:bg-emerald-500/12 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <ThumbsUp className="size-4" />
          </MessageAction>
          <MessageAction
            tooltip="Not helpful"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <ThumbsDown className="size-4" />
          </MessageAction>
          {meta?.memorySources?.length ? (
            <MessageAction
              tooltip="Sources"
              variant="ghost"
              size="icon-sm"
              className="ml-1 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              onClick={handleSources}
            >
              <BookOpen className="size-4" />
            </MessageAction>
          ) : null}
        </MessageActions>
      ) : null}
      {isLatestAssistantMessage && llmSuggestions.length > 0 ? (
        <Suggestions className="px-1">
          {llmSuggestions.map((suggestionText) => (
            <Suggestion
              key={suggestionText}
              className="font-normal text-foreground"
              onClick={() => onSuggestionClick(suggestionText)}
              suggestion={suggestionText}
            >
              <Sparkles size={16} />
              {suggestionText}
            </Suggestion>
          ))}
        </Suggestions>
      ) : null}
    </div>
  )

  return (
    <MessageBranch defaultBranch={branchIndex} onBranchChange={handleBranchChange}>
      <MessageBranchContent>
        <div className="flex w-full max-w-[95%] items-start gap-2">
          <AgentShapeAvatar
            className="self-start"
            shape={liveAgentShape}
            color="var(--color-primary)"
            icon={<Bot className="size-4" />}
          />
          <div className="min-w-0 flex-1">
            <Message from={msg.role as UIMessage["role"]} className="w-full max-w-full">
              {messageBody}
            </Message>
          </div>
        </div>
      </MessageBranchContent>

      {branchCount > 1 ? (
        <MessageBranchSelector className="px-0">
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      ) : null}
    </MessageBranch>
  )
}

export const AssistantMessageRowLive = memo(AssistantMessageRowLiveInner)
