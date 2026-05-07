import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Bot,
  BookOpen,
  Check,
  Copy,
  Lightbulb,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation"
import {
  Message,
  MessageActions,
  MessageAction,
  MessageContent,
} from "@/components/ai-elements/message"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { AgentShapeAvatar } from "@/components/chat/agent-shape-avatar"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  getPlaygroundShikiThemes,
  PLAYGROUND_MAX_WIDTH_CLASS,
  PLAYGROUND_VIEWPORT_CLASS,
  type PlaygroundUiConfig,
} from "@/pages/playground/playground-ui-config"

const MOCK_USER_TEXT = "What's the weather in San Francisco?"

const MOCK_ASSISTANT_MARKDOWN = `## UX design in 2026

The landscape is shifting toward **human-centered** workflows:

- Calm interfaces with fewer modal interruptions
- **Measurable** outcomes tied to task success, not vanity metrics

\`\`\`typescript
function summarize(input: string): string {
  return input.trim().slice(0, 120)
}
\`\`\`

> Great teams prototype in production-safe sandboxes first.
`

const MOCK_SUGGESTIONS = ["Tell me more", "Explain differently"]

function getThoughtHeader(config: PlaygroundUiConfig, isThinking: boolean, elapsedSeconds: number): ReactNode {
  if (!isThinking) {
    return `Thought for ${Math.max(1, elapsedSeconds)} seconds`
  }
  const text = config.thoughtLabel.text.trim() || "Thinking..."
  return (
    <Shimmer as="span" className="text-sm text-muted-foreground" duration={2.2}>
      {text}
    </Shimmer>
  )
}

function UserMessageRow({
  config,
  children,
}: {
  config: PlaygroundUiConfig
  children: ReactNode
}) {
  const row = (
    <Message from="user">
      <MessageContent
        className={cn(
          "rounded-lg px-4 py-3 text-foreground",
          config.colors.userBubble && "border border-transparent"
        )}
        style={{
          backgroundColor: config.colors.userBubble,
        }}
      >
        {children}
      </MessageContent>
    </Message>
  )

  if (!config.avatars.show) {
    return row
  }

  return (
    <div className="flex w-full max-w-[95%] flex-row-reverse items-end gap-2">
      <Avatar className="size-8 shrink-0 border border-border">
        <AvatarFallback
          className="text-xs text-background"
          style={{ backgroundColor: config.colors.userBubble }}
        >
          U
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">{row}</div>
    </div>
  )
}

function AssistantMessageRow({
  config,
  children,
}: {
  config: PlaygroundUiConfig
  children: ReactNode
}) {
  const inner = (
    <div
      className="space-y-2 rounded-2xl px-2 py-1"
      style={{
        backgroundColor: config.colors.assistantBubble,
      }}
    >
      {children}
    </div>
  )

  if (!config.avatars.show) {
    return <Message from="assistant">{inner}</Message>
  }

  return (
    <div className="flex w-full max-w-[95%] items-start gap-2">
      <AgentShapeAvatar
        className="self-start"
        shape={config.agentAvatar.shape}
        color={config.agentAvatar.fill}
        icon={<Bot className="size-4" />}
      />
      <div className="min-w-0 flex-1">
        <Message from="assistant">{inner}</Message>
      </div>
    </div>
  )
}

export function PlaygroundChatPreview({ config }: { config: PlaygroundUiConfig }) {
  const [copied, setCopied] = useState(false)
  const [isThinking, setIsThinking] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isChainOpen, setIsChainOpen] = useState(true)
  const codeThemes = useMemo(
    () => getPlaygroundShikiThemes(config.content.codeTheme),
    [config.content.codeTheme]
  )

  const maxClass = PLAYGROUND_MAX_WIDTH_CLASS[config.thread.maxWidth]
  const viewportShell = PLAYGROUND_VIEWPORT_CLASS[config.previewViewport]
  const thoughtDuration = Math.max(1, config.thoughtLabel.durationSeconds)

  useEffect(() => {
    if (!config.content.reasoning) return

    setIsThinking(true)
    setElapsedSeconds(0)
    setIsChainOpen(true)

    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      const nextElapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      setElapsedSeconds(nextElapsed)
    }, 250)

    const complete = window.setTimeout(() => {
      const finalElapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      setElapsedSeconds(finalElapsed)
      setIsThinking(false)
      setIsChainOpen(false)
      window.clearInterval(tick)
    }, thoughtDuration * 1000)

    return () => {
      window.clearInterval(tick)
      window.clearTimeout(complete)
    }
  }, [config.content.reasoning, thoughtDuration, config.thoughtLabel.text, config.thoughtLabel.variant])

  return (
    <div
      data-playground-preview
      className="flex min-h-0 flex-1 flex-col bg-muted/25"
    >
      <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-3 md:p-4">
        <div
          className={cn(
            "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background",
            viewportShell
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Conversation className="min-h-0 flex-1">
              <ConversationContent
                className={cn("mx-auto w-full min-h-full", maxClass)}
              >
                {config.thread.welcome ? (
                  <ConversationEmptyState className="min-h-full">
                    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-4 text-center">
                      <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                        <Sparkles className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                          Where should we start?
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          This is the welcome state. Turn off <strong>Welcome</strong> in the
                          panel to preview a full thread.
                        </p>
                      </div>
                      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant="outline" className="h-auto justify-start gap-2 rounded-2xl py-3">
                          <Lightbulb className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm">Sample prompt</span>
                        </Button>
                        <Button variant="outline" className="h-auto justify-start gap-2 rounded-2xl py-3">
                          <Lightbulb className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm">Another idea</span>
                        </Button>
                      </div>
                    </div>
                  </ConversationEmptyState>
                ) : (
                  <div className="flex min-h-full flex-col gap-8">
                    <UserMessageRow config={config}>{MOCK_USER_TEXT}</UserMessageRow>

                    <AssistantMessageRow config={config}>
                      {config.content.reasoning ? (
                        <ChainOfThought open={isChainOpen} onOpenChange={setIsChainOpen}>
                          <ChainOfThoughtHeader>
                            {getThoughtHeader(config, isThinking, elapsedSeconds)}
                          </ChainOfThoughtHeader>
                          <ChainOfThoughtContent>
                            <ChainOfThoughtStep
                              label="Understanding request"
                              description="Parsed intent and entities from the user message."
                              status="complete"
                            />
                            <ChainOfThoughtStep
                              label="Gathering sources"
                              description="Consulted internal knowledge and web references."
                              status="complete"
                            >
                              {config.content.sources ? (
                                <ChainOfThoughtSearchResults>
                                  <ChainOfThoughtSearchResult>React Documentation</ChainOfThoughtSearchResult>
                                  <ChainOfThoughtSearchResult>Next.js</ChainOfThoughtSearchResult>
                                </ChainOfThoughtSearchResults>
                              ) : null}
                            </ChainOfThoughtStep>
                            <ChainOfThoughtStep
                              label="Generating response"
                              description="Drafted markdown with structure and examples."
                              status="complete"
                            />
                          </ChainOfThoughtContent>
                        </ChainOfThought>
                      ) : null}

                      <MessageContent className="max-w-full bg-transparent px-0 py-0 text-foreground">
                        {config.content.markdown ? (
                          <MarkdownRenderer
                            markdown={MOCK_ASSISTANT_MARKDOWN}
                            codeThemes={codeThemes}
                            className="w-full !max-w-none"
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-sm">{MOCK_ASSISTANT_MARKDOWN}</pre>
                        )}
                      </MessageContent>

                      {config.content.sources ? (
                        <InlineCitation>
                          <InlineCitationCard>
                            <InlineCitationCardTrigger sources={["https://react.dev/"]} />
                            <InlineCitationCardBody>
                              <InlineCitationSource
                                title="React Documentation"
                                url="https://react.dev/"
                                description="Official React docs"
                              />
                            </InlineCitationCardBody>
                          </InlineCitationCard>
                          <InlineCitationCard>
                            <InlineCitationCardTrigger sources={["https://nextjs.org/"]} />
                            <InlineCitationCardBody>
                              <InlineCitationSource
                                title="Next.js"
                                url="https://nextjs.org/"
                                description="Next.js framework"
                              />
                            </InlineCitationCardBody>
                          </InlineCitationCard>
                        </InlineCitation>
                      ) : null}

                      {config.actions.copy || config.actions.feedback || config.actions.sourcesButton ? (
                        <MessageActions className="w-fit items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/65">
                          {config.actions.copy ? (
                            <MessageAction
                              tooltip="Copy message"
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              onClick={async () => {
                                await navigator.clipboard.writeText(MOCK_ASSISTANT_MARKDOWN)
                                setCopied(true)
                                window.setTimeout(() => setCopied(false), 1400)
                              }}
                            >
                              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </MessageAction>
                          ) : null}
                          {config.actions.feedback ? (
                            <>
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
                            </>
                          ) : null}
                          {config.actions.sourcesButton ? (
                            <MessageAction
                              tooltip="Sources"
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            >
                              <BookOpen className="size-4" />
                            </MessageAction>
                          ) : null}
                        </MessageActions>
                      ) : null}

                      {config.content.suggestions ? (
                        <Suggestions className="px-0">
                          {MOCK_SUGGESTIONS.map((text) => (
                            <Suggestion
                              key={text}
                              suggestion={text}
                              className="font-normal"
                            >
                              <Sparkles size={16} />
                              {text}
                            </Suggestion>
                          ))}
                        </Suggestions>
                      ) : null}
                    </AssistantMessageRow>
                  </div>
                )}
              </ConversationContent>
              {config.thread.scrollToBottom ? <ConversationScrollButton /> : null}
            </Conversation>

            <div
              className="shrink-0 border-t border-border p-4"
              style={
                config.composer.useCustomBackground
                  ? { backgroundColor: config.composer.backgroundColor }
                  : undefined
              }
            >
              <div className="mx-auto w-full max-w-3xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/80 p-2 shadow-sm">
                  {config.composer.attachments ? (
                    <div className="flex items-center gap-2 px-2 pt-1 text-muted-foreground">
                      <Paperclip className="size-4" />
                      <span className="text-xs">Attachments enabled</span>
                    </div>
                  ) : null}
                  <div className="px-2 pb-1 text-sm text-muted-foreground">
                    Ask anything (preview only)
                  </div>
                  <div className="flex items-center justify-between gap-2 px-1 pb-1">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" className="rounded-xl" type="button">
                        <Plus className="size-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl text-xs" type="button">
                        Model
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" className="rounded-xl" type="button">
                        <Mic className="size-4" />
                      </Button>
                      <Button size="icon-sm" className="rounded-full" type="button">
                        <Sparkles className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
