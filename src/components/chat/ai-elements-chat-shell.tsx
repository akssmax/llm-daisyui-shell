"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { UIMessage } from "ai"
import type { ToolUIPart } from "ai"

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
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
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
  PromptInputTools,
  usePromptInputAttachments,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { streamChat } from "@/lib/llm-service"
import type { ChatThread } from "@/lib/chat-threads"
import { MISTRAL_MODELS, type MistralModel } from "@/lib/llm-types"
import type { MockChatItem } from "@/lib/mock-chat-data"

import {
  Brain,
  Check,
  Copy,
  Lightbulb,
  Mic,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

type ChatStatus = "ready" | "submitted" | "streaming" | "error"

type EmptyStateAction = {
  label: string
  prompt: string
}

const EMPTY_STATE_PROMPT_POOL: EmptyStateAction[] = [
  { label: "Plan my day", prompt: "Create a focused plan for my day with priorities and time blocks." },
  { label: "Weekly goals", prompt: "Help me define 5 realistic goals for this week with measurable outcomes." },
  { label: "Project kickoff", prompt: "Draft a project kickoff checklist with owners, milestones, and risks." },
  { label: "Meeting prep", prompt: "Prepare a concise agenda and talking points for my upcoming team meeting." },
  { label: "Decision memo", prompt: "Write a one-page decision memo comparing two implementation options." },
  { label: "Status update", prompt: "Draft a crisp weekly status update with wins, blockers, and next steps." },
  { label: "Email draft", prompt: "Write a professional follow-up email after a product demo call." },
  { label: "LinkedIn post", prompt: "Write a polished first draft for a LinkedIn post about AI workflows." },
  { label: "Blog outline", prompt: "Create a detailed blog post outline on improving onboarding conversion." },
  { label: "Landing page copy", prompt: "Draft high-converting hero, features, and CTA copy for a landing page." },
  { label: "Ad ideas", prompt: "Generate 10 ad copy ideas for a productivity app targeting startup founders." },
  { label: "Pitch deck story", prompt: "Build a narrative arc for a 10-slide startup pitch deck." },
  { label: "Research summary", prompt: "Summarize this topic into key insights, trends, and implications." },
  { label: "Competitor analysis", prompt: "Compare top competitors across positioning, pricing, and feature gaps." },
  { label: "Market sizing", prompt: "Estimate TAM/SAM/SOM for an AI recruiting assistant product." },
  { label: "Customer personas", prompt: "Create 3 customer personas with pains, goals, and buying triggers." },
  { label: "Interview questions", prompt: "Generate user interview questions to validate a new product idea." },
  { label: "Survey design", prompt: "Create a short customer survey with neutral, bias-free questions." },
  { label: "Feature prioritization", prompt: "Prioritize these features using RICE and explain the ranking." },
  { label: "Roadmap draft", prompt: "Draft a 90-day product roadmap with themes and milestones." },
  { label: "Bug triage", prompt: "Help triage these bugs by severity, impact, and suggested fixes." },
  { label: "Release notes", prompt: "Write clear release notes for a new version with highlights and fixes." },
  { label: "PR review checklist", prompt: "Create a practical pull request review checklist for our team." },
  { label: "Refactor plan", prompt: "Propose a safe refactor plan with phases, tests, and rollback strategy." },
  { label: "API design", prompt: "Design a clean REST API for task management including endpoints and payloads." },
  { label: "Test strategy", prompt: "Create a test strategy for a React app covering unit, integration, and e2e." },
  { label: "Performance audit", prompt: "List likely frontend performance bottlenecks and how to fix each one." },
  { label: "Security review", prompt: "Run a lightweight security review checklist for a web application." },
  { label: "Data model", prompt: "Design a simple relational schema for users, teams, and projects." },
  { label: "SQL help", prompt: "Write a SQL query to find monthly active users with a 30-day retention view." },
  { label: "Dashboard metrics", prompt: "Suggest the most useful metrics for a SaaS executive dashboard." },
  { label: "Analyze a file", prompt: "Help me analyze this file and highlight key insights with next steps." },
  { label: "Executive summary", prompt: "Condense this long text into a concise executive summary." },
  { label: "Rewrite for clarity", prompt: "Rewrite this content to be clearer, shorter, and more actionable." },
  { label: "Tone adjustment", prompt: "Rewrite this message in a warm but professional tone." },
  { label: "Grammar polish", prompt: "Proofread this draft and return a corrected, polished version." },
  { label: "Learning plan", prompt: "Create a 4-week learning plan to improve my system design skills." },
  { label: "Explain simply", prompt: "Explain this technical concept like I am new to software engineering." },
  { label: "Interview prep", prompt: "Simulate a product manager interview and ask me challenging questions." },
  { label: "Career strategy", prompt: "Suggest a 6-month career growth plan for a frontend engineer." },
  { label: "Networking message", prompt: "Draft a short networking message to connect with a hiring manager." },
  { label: "Negotiation script", prompt: "Give me a salary negotiation script for an offer discussion call." },
  { label: "Habit tracker ideas", prompt: "Brainstorm simple habit tracking systems that are easy to maintain." },
  { label: "Travel planner", prompt: "Plan a 3-day trip itinerary with balanced work and sightseeing." },
  { label: "Meal planning", prompt: "Create a healthy weekly meal plan with a simple grocery list." },
  { label: "Brainstorm ideas", prompt: "Give me 10 creative ideas for improving user onboarding conversion." },
  { label: "Name generator", prompt: "Suggest 20 brandable names for an AI productivity assistant." },
  { label: "Workshop agenda", prompt: "Create a 60-minute workshop agenda to align cross-functional teams." },
]

const EMPTY_STATE_PROMPT_COUNT = 4

function pickRandomEmptyStateActions(
  pool: EmptyStateAction[],
  count: number
): EmptyStateAction[] {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function toTextMessage(id: string, role: UIMessage["role"], text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] }
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function estimateTokenCount(text: string): number {
  if (!text.trim()) return 0
  return Math.ceil(text.length / 4)
}

const MODEL_CONTEXT_LIMITS: Record<MistralModel, number> = {
  "mistral-small-latest": 8192,
  "mistral-medium-latest": 8192,
  "mistral-large-latest": 8192,
}

function PromptInputAttachmentStrip() {
  const attachments = usePromptInputAttachments()

  if (attachments.files.length === 0) return null

  return (
    <Attachments
      variant="inline"
      className="order-first w-full justify-start px-2.5 pt-2"
    >
      {attachments.files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

export function AIElementsChatShell({
  className,
  thread,
  onUpdateThread,
}: {
  className?: string
  thread: ChatThread
  onUpdateThread: (threadId: string, updater: (thread: ChatThread) => ChatThread) => void
}) {
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [text, setText] = useState("")
  const [activeBranch, setActiveBranch] = useState<Record<string, number>>({})
  const [selectedModel, setSelectedModel] = useState<MistralModel>("mistral-small-latest")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [llmSuggestions, setLlmSuggestions] = useState<string[]>([])
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [emptyStateActions, setEmptyStateActions] = useState<EmptyStateAction[]>(() =>
    pickRandomEmptyStateActions(EMPTY_STATE_PROMPT_POOL, EMPTY_STATE_PROMPT_COUNT)
  )
  const messages = thread.messages

  const contextMetrics = useMemo(() => {
    const inputTokens = estimateTokenCount(text)
    const messageTokens = messages.reduce((total, item) => {
      return total + estimateTokenCount(getMessageText(item.message))
    }, 0)
    const usedTokens = inputTokens + messageTokens
    const maxTokens = MODEL_CONTEXT_LIMITS[selectedModel] ?? 8192

    return {
      maxTokens,
      usedTokens,
    }
  }, [messages, selectedModel, text])

  const assistant = useMemo(() => messages.find((m) => m.message.role === "assistant"), [messages])
  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.message.role === "assistant") {
        return messages[index]?.id ?? null
      }
    }
    return null
  }, [messages])

  const updateThreadMessages = useCallback(
    (updater: (prev: MockChatItem[]) => MockChatItem[]) => {
      onUpdateThread(thread.threadId, (current) => ({
        ...current,
        messages: updater(current.messages),
      }))
    },
    [onUpdateThread, thread.threadId]
  )

  useEffect(() => {
    return () => {
      abortController?.abort()
    }
  }, [abortController])

  useEffect(() => {
    abortController?.abort()
    setStatus("ready")
    setText("")
    setLlmSuggestions([])
    setCopiedMessageId(null)
    setActiveBranch({})
    setEmptyStateActions(
      pickRandomEmptyStateActions(EMPTY_STATE_PROMPT_POOL, EMPTY_STATE_PROMPT_COUNT)
    )
  }, [thread.threadId])

  const refineChatTitle = useCallback(async (firstUserMessage: string, threadId: string) => {
    const prompt = [
      "Create a short chat title for this user request.",
      "Rules:",
      "- Max 6 words",
      "- Plain text only",
      "- No quotes, no punctuation at the end",
      "",
      `User request: ${firstUserMessage}`,
    ].join("\n")

    let generatedTitle = ""
    try {
      await streamChat({
        maxTokens: 24,
        messages: [{ content: prompt, role: "user" }],
        model: "mistral-small-latest",
        onToken: (token) => {
          generatedTitle += token
        },
        temperature: 0.2,
      })
      const cleanTitle = generatedTitle
        .trim()
        .replace(/^["'`]+|["'`]+$/g, "")
        .split("\n")[0]
        ?.trim()

      if (cleanTitle) {
        onUpdateThread(threadId, (current) => ({
          ...current,
          title: cleanTitle.slice(0, 64),
        }))
      }
    } catch {
      // Title refinement is optional; keep the original title on failure.
    }
  }, [onUpdateThread])

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim())
      const hasFiles = Boolean(message.files?.length)
      if (!hasText && !hasFiles) return

      setStatus("submitted")

      const userId = `u-${Date.now()}`
      const userText = message.text || (hasFiles ? "Sent with attachments" : "")
      const isFirstUserMessage = messages.every((item) => item.message.role !== "user")

      if (isFirstUserMessage && userText.trim()) {
        const initialTitle = userText.trim().slice(0, 72)
        onUpdateThread(thread.threadId, (current) => ({
          ...current,
          title: initialTitle,
        }))
        window.setTimeout(() => {
          void refineChatTitle(initialTitle, thread.threadId)
        }, 1800)
      }

      const userAttachments = (message.files ?? []).map((file, index) => ({
        ...file,
        id: `${userId}-file-${index}`,
      }))
      updateThreadMessages((prev) => [
        ...prev,
        {
          id: userId,
          message: toTextMessage(userId, "user", userText),
          meta: userAttachments.length > 0 ? { attachments: userAttachments } : undefined,
        },
      ])

      setText("")
      setLlmSuggestions([])
      setStatus("streaming")

      const assistantId = `a-${Date.now()}`
      const assistantItem = {
        id: assistantId,
        message: toTextMessage(assistantId, "assistant", ""),
        meta: {},
      }

      updateThreadMessages((prev) => [...prev, assistantItem])

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
          messages: history,
          model: selectedModel,
          onToken: (chunk) => {
            updateThreadMessages((prev) =>
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
          onReasoning: (reasoning) => {
            updateThreadMessages((prev) =>
              prev.map((it) =>
                it.id === assistantId
                  ? {
                      ...it,
                      meta: {
                        ...(it.meta ?? {}),
                        reasoning,
                      },
                    }
                  : it
              )
            )
          },
          onSources: (sources) => {
            updateThreadMessages((prev) =>
              prev.map((it) =>
                it.id === assistantId
                  ? {
                      ...it,
                      meta: {
                        ...(it.meta ?? {}),
                        sources,
                      },
                    }
                  : it
              )
            )
          },
          onCitations: (citations) => {
            updateThreadMessages((prev) =>
              prev.map((it) =>
                it.id === assistantId
                  ? {
                      ...it,
                      meta: {
                        ...(it.meta ?? {}),
                        citations,
                      },
                    }
                  : it
              )
            )
          },
          signal: controller.signal,
          temperature: 0.7,
        })
        setStatus("ready")
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get response."
        updateThreadMessages((prev) =>
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
    [messages, onUpdateThread, refineChatTitle, selectedModel, thread.threadId, updateThreadMessages]
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
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Context
            usedTokens={contextMetrics.usedTokens}
            maxTokens={contextMetrics.maxTokens}
            modelId={selectedModel}
          >
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
        </div>
      </div>

      <Conversation>
        <ConversationContent
          className={cn(
            "mx-auto w-full max-w-[768px]",
            messages.length === 0 && "min-h-full"
          )}
        >
          {messages.length === 0 ? (
            <ConversationEmptyState className="min-h-full">
              <div className="mx-auto flex w-full max-w-[680px] flex-col items-center gap-5 text-center">
                <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                  <Sparkles className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                    Where should we start?
                  </h2>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    Pick a prompt to begin, or type your own request below.
                  </p>
                </div>

                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  {emptyStateActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto justify-start gap-2 rounded-2xl px-4 py-3 text-left"
                      onClick={() => handleSuggestionClick(action.prompt)}
                    >
                      <Lightbulb className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-foreground">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((item) => {
              const msg = item.message
              const meta = item.meta
              const branchIndex = activeBranch[item.id] ?? 0
              const branchCount = item.branches?.length ?? 0
              const isLatestAssistantMessage =
                msg.role === "assistant" && item.id === latestAssistantMessageId
              const showFeedbackBar =
                msg.role === "assistant" &&
                (!isLatestAssistantMessage || status !== "streaming")

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
                        {msg.role === "user" && meta?.attachments?.length ? (
                          <Attachments variant="grid">
                            {meta.attachments.map((attachment) => (
                              <Attachment key={attachment.id} data={attachment}>
                                <AttachmentPreview />
                              </Attachment>
                            ))}
                          </Attachments>
                        ) : null}

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

                        {showFeedbackBar ? (
                          <MessageActions className="w-fit items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/65">
                            <MessageAction
                              tooltip="Copy message"
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              onClick={async () => {
                                const text = getMessageText(msg)
                                if (!text) return
                                await navigator.clipboard.writeText(text)
                                setCopiedMessageId(item.id)
                                window.setTimeout(() => {
                                  setCopiedMessageId((current) =>
                                    current === item.id ? null : current
                                  )
                                }, 1600)
                              }}
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
                          </MessageActions>
                        ) : null}
                        {isLatestAssistantMessage && llmSuggestions.length > 0 ? (
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
              <PromptInputAttachmentStrip />
              <PromptInputTextarea
                onChange={(e) => setText(e.target.value)}
                value={text}
                placeholder="Ask anything"
              />
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger
                      variant="outline"
                      className="rounded-xl"
                      tooltip="Add context"
                    >
                      <Plus className="size-4" />
                    </PromptInputActionMenuTrigger>
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                      <PromptInputActionAddScreenshot />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>

                  <Select
                    onValueChange={(value) => setSelectedModel(value as MistralModel)}
                    value={selectedModel}
                  >
                    <SelectTrigger className="h-8 min-w-44 rounded-xl bg-background text-xs text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Brain className="size-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Select model" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {MISTRAL_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PromptInputTools>

                <PromptInputTools className="justify-end">
                  <PromptInputButton
                    variant="outline"
                    className="rounded-xl"
                    tooltip="Voice dictation"
                  >
                    <Mic className="size-4" />
                  </PromptInputButton>
                  <PromptInputSubmit
                    disabled={status === "streaming"}
                    onStop={() => {
                      abortController?.abort()
                      setStatus("ready")
                    }}
                    status={status === "streaming" ? "streaming" : undefined}
                  />
                </PromptInputTools>
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>

          {/* Attachments preview is intentionally hidden for now.
              It will move into the chat input box component later. */}

        </div>
      </div>
    </div>
  )
}

