"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { UIMessage } from "ai"
import type { ToolUIPart } from "ai"

import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "@/components/ai-elements/checkpoint"
import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextTrigger,
} from "@/components/ai-elements/context"
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
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
} from "@/components/ai-elements/message"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorItem,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { streamChat } from "@/lib/llm-service"
import { MISTRAL_MODELS, type MistralModel } from "@/lib/llm-types"
import type { MockChatItem } from "@/lib/mock-chat-data"

import {
  CheckCircle2,
  Copy,
  FileText,
  Globe,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

type ChatStatus = "ready" | "submitted" | "streaming" | "error"

function toTextMessage(id: string, role: UIMessage["role"], text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] }
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function AIElementsChatShell({ className }: { className?: string }) {
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [text, setText] = useState("")
  const [messages, setMessages] = useState<MockChatItem[]>([])
  const [activeBranch, setActiveBranch] = useState<Record<string, number>>({})
  const [selectedModel, setSelectedModel] = useState<MistralModel>("mistral-small-latest")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [llmSuggestions, setLlmSuggestions] = useState<string[]>([])

  const assistant = useMemo(() => messages.find((m) => m.message.role === "assistant"), [messages])

  useEffect(() => {
    return () => {
      abortController?.abort()
    }
  }, [abortController])

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim())
      const hasFiles = Boolean(message.files?.length)
      if (!hasText && !hasFiles) return

      setStatus("submitted")

      const userId = `u-${Date.now()}`
      const userText = message.text || (hasFiles ? "Sent with attachments" : "")
      setMessages((prev) => [
        ...prev,
        { id: userId, message: toTextMessage(userId, "user", userText) },
      ])

      setText("")
      setLlmSuggestions([])
      setStatus("streaming")

      const assistantId = `a-${Date.now()}`
      const assistantItem = {
        id: assistantId,
        message: toTextMessage(assistantId, "assistant", ""),
      }

      setMessages((prev) => [...prev, assistantItem])

      const controller = new AbortController()
      setAbortController(controller)

      const history = [
        ...messages.map((item) => ({
          content: getMessageText(item.message),
          role: item.message.role,
        })),
        { content: userText, role: "user" as const },
      ]

      try {
        await streamChat({
          attachments: message.files,
          maxTokens: 1200,
          messages: history,
          model: selectedModel,
          onToken: (chunk) => {
            setMessages((prev) =>
              prev.map((it) => {
                if (it.id !== assistantId) return it
                const previous = getMessageText(it.message)
                return {
                  ...it,
                  message: toTextMessage(it.message.id, "assistant", `${previous}${chunk}`),
                }
              })
            )
          },
          onSuggestions: (suggestions) => {
            setLlmSuggestions(suggestions)
          },
          signal: controller.signal,
          temperature: 0.7,
        })
        setStatus("ready")
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get response."
        setMessages((prev) =>
          prev.map((it) =>
            it.id === assistantId
              ? {
                  ...it,
                  message: toTextMessage(
                    it.message.id,
                    "assistant",
                    `Unable to complete response: ${errorMessage}`
                  ),
                }
              : it
          )
        )
        setStatus("error")
      } finally {
        setAbortController(null)
      }
    },
    [messages, selectedModel]
  )

  const handleSuggestionClick = useCallback(
    (suggestionText: string) => {
      handleSubmit({ text: suggestionText, files: [] })
    },
    [handleSubmit]
  )

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Top helper strip to showcase non-message components */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Mistral live chat
          </Badge>
          <Context usedTokens={1234} maxTokens={8192} modelId={selectedModel}>
            <ContextTrigger />
            <ContextContent>
              <ContextContentHeader />
              <ContextContentBody>
                <div className="text-sm text-foreground">
                  {assistant?.meta?.context?.value ?? "Recruiter Agent"}
                </div>
              </ContextContentBody>
            </ContextContent>
          </Context>
          <ModelSelector>
            <ModelSelectorTrigger />
            <ModelSelectorContent>
              {MISTRAL_MODELS.map((model) => (
                <ModelSelectorItem key={model} onSelect={() => setSelectedModel(model)}>
                  {model}
                </ModelSelectorItem>
              ))}
            </ModelSelectorContent>
          </ModelSelector>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {selectedModel}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Checkpoint>
            <CheckpointIcon />
            <CheckpointTrigger tooltip="Mock checkpoint">Checkpoint</CheckpointTrigger>
          </Checkpoint>
        </div>
      </div>

      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-[768px]">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="No messages yet"
              description="Use the prompt input to start."
              icon={<CheckCircle2 className="size-5" />}
            />
          ) : (
            messages.map((item) => {
              const msg = item.message
              const meta = item.meta
              const branchIndex = activeBranch[item.id] ?? 0
              const branchCount = item.branches?.length ?? 0

              return (
                <MessageBranch
                  key={item.id}
                  defaultBranch={branchIndex}
                  onBranchChange={(next) =>
                    setActiveBranch((prev) => ({ ...prev, [item.id]: next }))
                  }
                >
                  <MessageBranchContent>
                    <Message from={msg.role}>
                      <div className="space-y-2">
                        {meta?.sources?.length ? (
                          <Sources>
                            <SourcesTrigger count={meta.sources.length} />
                            <SourcesContent>
                              {meta.sources.map((s) => (
                                <Source key={s.href} href={s.href} title={s.title} />
                              ))}
                            </SourcesContent>
                          </Sources>
                        ) : null}

                        {meta?.reasoning ? (
                          <Reasoning
                            duration={meta.reasoning.durationSeconds}
                            isStreaming={status === "streaming"}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{meta.reasoning.content}</ReasoningContent>
                          </Reasoning>
                        ) : null}

                        <MessageContent>
                          {msg.role === "assistant" ? (
                            <MarkdownRenderer markdown={getMessageText(msg)} />
                          ) : (
                            getMessageText(msg)
                          )}
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

                        {meta?.tools?.length ? (
                          <div className="space-y-2">
                            {meta.tools.map((t) => (
                              <Tool key={t.name}>
                                <ToolHeader
                                  title={t.description}
                                  type={"dynamic-tool"}
                                  toolName={t.name}
                                  state={t.state as ToolUIPart["state"]}
                                />
                                <ToolContent>
                                  <ToolInput input={t.input ?? {}} />
                                  <ToolOutput output={t.output} errorText={undefined} />
                                </ToolContent>
                              </Tool>
                            ))}
                          </div>
                        ) : null}

                        <MessageActions className="rounded-md border border-border/60 bg-muted/40 p-1 opacity-85">
                          <MessageAction
                            tooltip="Copy message"
                            variant="ghost"
                            size="icon-sm"
                            onClick={async () => {
                              const text = getMessageText(msg)
                              if (!text) return
                              await navigator.clipboard.writeText(text)
                            }}
                          >
                            <Copy className="size-4" />
                          </MessageAction>
                          <MessageAction tooltip="Helpful" variant="ghost" size="icon-sm">
                            <ThumbsUp className="size-4" />
                          </MessageAction>
                          <MessageAction tooltip="Not helpful" variant="ghost" size="icon-sm">
                            <ThumbsDown className="size-4" />
                          </MessageAction>
                        </MessageActions>
                      </div>
                    </Message>
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
            })
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background">
        <div className="mx-auto grid max-w-3xl gap-3 p-4">
          {/* Plan and Queue are intentionally hidden for now.
              They will move into the chat input box component later. */}

          <PromptInputProvider>
            <PromptInput maxFileSize={5 * 1024 * 1024} maxFiles={4} onSubmit={handleSubmit}>
              <PromptInputTextarea
                onChange={(e) => setText(e.target.value)}
                value={text}
                placeholder="type @ for adding tabs or workflows"
              />
              <PromptInputFooter>
                <PromptInputButton variant="outline" className="rounded-full">
                  <Search className="size-4" />
                  Search
                </PromptInputButton>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger variant="outline" tooltip="Add attachment options" />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                    <PromptInputActionAddScreenshot />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputSubmit
                  disabled={status === "streaming"}
                  onStop={() => {
                    abortController?.abort()
                    setStatus("ready")
                  }}
                  status={status === "streaming" ? "streaming" : undefined}
                />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>

          {/* Attachments preview is intentionally hidden for now.
              It will move into the chat input box component later. */}

          {llmSuggestions.length > 0 ? (
            <Suggestions className="px-1">
              {llmSuggestions.map((suggestionText) => (
              <Suggestion
                key={suggestionText}
                className="font-normal text-foreground"
                onClick={() => handleSuggestionClick(suggestionText)}
                suggestion={suggestionText}
              >
                <Sparkles size={16} />
                {suggestionText}
              </Suggestion>
              ))}
            </Suggestions>
          ) : null}
        </div>
      </div>
    </div>
  )
}

