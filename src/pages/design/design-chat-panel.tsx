import { useCallback, useEffect, useRef, useState } from "react"
import { nanoid } from "nanoid"
import type { FileUIPart } from "ai"
import { AlertCircle, Brain, Check, Copy, Plus, Shuffle, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageAction, MessageActions, MessageContent } from "@/components/ai-elements/message"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation"
import { CollapsibleContent } from "@/components/ui/collapsible"
import { Reasoning, ReasoningTrigger } from "@/components/ai-elements/reasoning"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DesignAgentChainOfThought } from "./components/design-agent-chain-of-thought"
import { updateDesignMemoryRating } from "./lib/layout-intelligence/design-memory-store"
import type { DesignAgentPhaseTrace } from "./lib/design-agent-orchestrator"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MISTRAL_MODELS } from "@/lib/llm-types"
import type { MistralModel } from "@/lib/llm-types"
import type { StreamChatResult } from "@/lib/llm-service"
import { useDesignStore } from "./store/design-store"
import type { DesignAiResponse } from "./types"
import { sendDesignMessage, type DesignChatMessage, type DesignAssistantStreamMeta } from "./lib/design-ai-service"
import { pickRandomStarterPrompts } from "./lib/design-starter-prompts"
import { LayersPanel } from "./components/layers/layers-panel"
import { DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE } from "./lib/design-json-parser"

const CONTINUE_RESPONSE_PROMPT =
  "Continue from where you left off and complete the previous answer."

const MAX_TRACE_CHARS = 8000

function displayAssistantContent(parsed: DesignAiResponse): string {
  if (parsed.kind === "message") {
    const base = parsed.text
    const note = parsed.assistantNote?.trim()
    return note ? `${base}\n\n${note}` : base
  }
  const note = parsed.assistantNote?.trim()
  if (note) return note
  if (parsed.kind === "document") {
    return `Created “${parsed.document.title}”. Describe tweaks or another slide to refine it.`
  }
  const title = useDesignStore.getState().document?.title ?? "your design"
  return `Applied ${parsed.patches.length} update(s) to “${title}”. Say what to adjust next.`
}

function DesignPromptAttachmentStrip() {
  const attachments = usePromptInputAttachments()

  if (attachments.files.length === 0) return null

  return (
    <Attachments variant="inline" className="order-first w-full justify-start px-2.5 pt-2">
      {attachments.files.map((file) => (
        <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

export function DesignChatPanel() {
  const [messages, setMessages] = useState<DesignChatMessage[]>([])
  const [starterSuggestions, setStarterSuggestions] = useState(() => pickRandomStarterPrompts())
  const prevMessageCountRef = useRef(0)
  const [chatStatus, setChatStatus] = useState<"ready" | "streaming" | "error">("ready")
  const [streamTrace, setStreamTrace] = useState("")
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([])
  const [completionNotice, setCompletionNotice] = useState<{
    message: string
    actionPrompt?: string
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipInitialChatResetEffect = useRef(true)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [agentLivePhases, setAgentLivePhases] = useState<DesignAgentPhaseTrace[]>([])
  const [chainOpenByAssistant, setChainOpenByAssistant] = useState<Record<string, boolean>>({})

  const streamTraceFullRef = useRef("")
  const streamTraceRafRef = useRef<number | null>(null)

  const flushStreamTrace = useCallback(() => {
    if (streamTraceRafRef.current != null) {
      cancelAnimationFrame(streamTraceRafRef.current)
      streamTraceRafRef.current = null
    }
    const full = streamTraceFullRef.current
    setStreamTrace(full.length > MAX_TRACE_CHARS ? full.slice(-MAX_TRACE_CHARS) : full)
  }, [])

  const scheduleStreamTraceFlush = useCallback(() => {
    if (streamTraceRafRef.current != null) return
    streamTraceRafRef.current = requestAnimationFrame(() => {
      streamTraceRafRef.current = null
      const next = streamTraceFullRef.current
      setStreamTrace(next.length > MAX_TRACE_CHARS ? next.slice(-MAX_TRACE_CHARS) : next)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (streamTraceRafRef.current != null) {
        cancelAnimationFrame(streamTraceRafRef.current)
        streamTraceRafRef.current = null
      }
    }
  }, [])

  const {
    setDocument,
    applyPatches,
    isAiLoading,
    setAiLoading,
    designChatModel,
    setDesignChatModel,
    designChatThreadNonce,
    designAgentPipelineEnabled,
    setDesignAgentPipelineEnabled,
  } = useDesignStore(
    useShallow((s) => ({
      setDocument: s.setDocument,
      applyPatches: s.applyPatches,
      isAiLoading: s.isAiLoading,
      setAiLoading: s.setAiLoading,
      designChatModel: s.designChatModel,
      setDesignChatModel: s.setDesignChatModel,
      designChatThreadNonce: s.designChatThreadNonce,
      designAgentPipelineEnabled: s.designAgentPipelineEnabled,
      setDesignAgentPipelineEnabled: s.setDesignAgentPipelineEnabled,
    })),
  )

  const handleThumbRating = useCallback(async (rating: 1 | -1) => {
    const { lastLayoutId, document } = useDesignStore.getState()
    if (!lastLayoutId || !document) return
    await updateDesignMemoryRating(lastLayoutId, rating, document.type)
  }, [])

  useEffect(() => {
    if (skipInitialChatResetEffect.current) {
      skipInitialChatResetEffect.current = false
      return
    }
    abortRef.current?.abort()
    abortRef.current = null
    if (streamTraceRafRef.current != null) {
      cancelAnimationFrame(streamTraceRafRef.current)
      streamTraceRafRef.current = null
    }
    streamTraceFullRef.current = ""
    setMessages([])
    setChatStatus("ready")
    setStreamTrace("")
    setFollowUpSuggestions([])
    setCompletionNotice(null)
    setStarterSuggestions(pickRandomStarterPrompts())
    setAiLoading(false)
    prevMessageCountRef.current = 0
    setAgentLivePhases([])
    setChainOpenByAssistant({})
  }, [designChatThreadNonce, setAiLoading])

  useEffect(() => {
    const prev = prevMessageCountRef.current
    prevMessageCountRef.current = messages.length
    if (messages.length === 0 && prev > 0) {
      setStarterSuggestions(pickRandomStarterPrompts())
    }
  }, [messages.length])

  const handleCopyMessage = useCallback(async (messageId: string, text: string) => {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(messageId)
      window.setTimeout(() => setCopiedMessageId(null), 2000)
    } catch {
      // ignore
    }
  }, [])

  const send = useCallback(
    async (text: string, files: FileUIPart[] = []) => {
      const hasText = Boolean(text.trim())
      const hasFiles = files.length > 0
      if ((!hasText && !hasFiles) || isAiLoading) return

      const displayText = text.trim() || (hasFiles ? "Sent with attachments" : "")

      const agentForTurn = useDesignStore.getState().designAgentPipelineEnabled

      const userMsg: DesignChatMessage = {
        id: nanoid(),
        role: "user",
        content: displayText,
        ...(hasFiles ? { attachments: files.map((f) => ({ ...f })) } : {}),
      }
      const assistantId = nanoid()
      const assistantMsg: DesignChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
        agentPipelineForTurn: agentForTurn,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setAiLoading(true)
      setChatStatus("streaming")
      if (streamTraceRafRef.current != null) {
        cancelAnimationFrame(streamTraceRafRef.current)
        streamTraceRafRef.current = null
      }
      streamTraceFullRef.current = ""
      setStreamTrace("")
      setFollowUpSuggestions([])
      setCompletionNotice(null)
      setAgentLivePhases([])
      setChainOpenByAssistant((prev) => ({ ...prev, [assistantId]: true }))

      abortRef.current = new AbortController()

      await sendDesignMessage({
        userMessage: displayText,
        history: messages,
        attachments: hasFiles ? files : undefined,
        signal: abortRef.current.signal,
        agentPipelineForTurn: agentForTurn,
        onDesignAgentPhase: (trace) => {
          setAgentLivePhases((prev) => {
            const j = prev.findIndex((p) => p.id === trace.id)
            if (j === -1) return [...prev, trace]
            const next = [...prev]
            next[j] = trace
            return next
          })
        },
        onSuggestions: (suggestions) => {
          setFollowUpSuggestions(suggestions)
        },
        onStreamResult: (result: StreamChatResult) => {
          if (result.completionStatus === "max_tokens_reached") {
            setCompletionNotice({
              message:
                "Response reached the output token limit and was truncated. Continue to get the rest.",
              actionPrompt: CONTINUE_RESPONSE_PROMPT,
            })
          }
        },
        onToken: (token) => {
          if (agentForTurn) return
          streamTraceFullRef.current += token
          scheduleStreamTraceFlush()
        },
        onComplete: (parsed, streamMeta: DesignAssistantStreamMeta) => {
          flushStreamTrace()
          setAiLoading(false)
          setChatStatus("ready")
          if (parsed.kind === "document") {
            setDocument(parsed.document)
          } else if (parsed.kind === "patches") {
            applyPatches(parsed.patches)
          }
          const content = displayAssistantContent(parsed)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content,
                    isStreaming: false,
                    sources: streamMeta.sources.length > 0 ? streamMeta.sources : undefined,
                    citations: streamMeta.citations.length > 0 ? streamMeta.citations : undefined,
                    agentTrace: streamMeta.agentTrace,
                  }
                : m,
            ),
          )
          setAgentLivePhases([])
          if (parsed.kind === "message" && parsed.text === DESIGN_MODEL_PARSE_TRUNCATED_MESSAGE) {
            setCompletionNotice({
              message: parsed.text,
              actionPrompt: CONTINUE_RESPONSE_PROMPT,
            })
          }
        },
        onError: (errMsg) => {
          flushStreamTrace()
          setAiLoading(false)
          setChatStatus("error")
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: "", isStreaming: false, error: errMsg } : m,
            ),
          )
        },
      })
    },
    [messages, isAiLoading, setDocument, applyPatches, setAiLoading, flushStreamTrace, scheduleStreamTraceFlush],
  )

  function handleSubmit(message: PromptInputMessage) {
    const hasText = Boolean(message.text?.trim())
    const hasFiles = Boolean(message.files?.length)
    if (!hasText && !hasFiles) return
    void send(message.text ?? "", message.files ?? [])
  }

  function handleStop() {
    abortRef.current?.abort()
    flushStreamTrace()
    setAiLoading(false)
    setChatStatus("ready")
    setAgentLivePhases([])
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false, content: m.content || "Stopped." } : m,
      ),
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="px-3 py-3">
          {messages.length === 0 ? (
            <ConversationEmptyState className="min-h-full">
              <div className="flex flex-col gap-4 pt-4">
                <p className="text-center text-sm text-muted-foreground">
                  Describe the design you want to create
                </p>
                <div className="flex flex-col gap-2">
                  {starterSuggestions.map((s, i) => (
                    <button
                      key={`${i}-${s.slice(0, 48)}`}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mx-auto gap-1.5 rounded-lg text-xs"
                  onClick={() => setStarterSuggestions(pickRandomStarterPrompts())}
                >
                  <Shuffle className="size-3.5 shrink-0" aria-hidden />
                  Shuffle suggestions
                </Button>
              </div>
            </ConversationEmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <Message key={msg.id} from={msg.role}>
                  {msg.role === "user" ? (
                    <div className="space-y-2">
                      <MessageContent>
                        <MarkdownRenderer markdown={msg.content} className="w-full !max-w-none" />
                      </MessageContent>
                      {(msg.attachments?.length ?? 0) > 0 ? (
                        <Attachments variant="inline" className="w-full flex-wrap justify-start">
                          {msg.attachments!.map((file) => (
                            <Attachment key={file.id} data={file} onRemove={() => {}}>
                              <AttachmentPreview />
                              <AttachmentInfo />
                            </Attachment>
                          ))}
                        </Attachments>
                      ) : null}
                    </div>
                  ) : msg.isStreaming ? (
                    msg.agentPipelineForTurn ? (
                      <DesignAgentChainOfThought
                        assistantId={msg.id}
                        phases={agentLivePhases}
                        isStreaming
                        chainOpen={chainOpenByAssistant[msg.id] ?? true}
                        onOpenChange={(open) =>
                          setChainOpenByAssistant((prev) => ({ ...prev, [msg.id]: open }))
                        }
                        streamTrace=""
                      />
                    ) : (
                      <Reasoning isStreaming>
                        <ReasoningTrigger />
                        <CollapsibleContent
                          className={cn(
                            "mt-4 text-sm",
                            "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
                          )}
                        >
                          <p className="text-xs font-medium text-foreground">Streaming model output (JSON)</p>
                          <pre
                            className="mt-2 max-h-[min(50vh,480px)] overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-foreground"
                            suppressHydrationWarning
                          >
                            {streamTrace || "Waiting for first token…"}
                          </pre>
                        </CollapsibleContent>
                      </Reasoning>
                    )
                  ) : msg.error ? (
                    <MessageContent className="flex items-center gap-1.5 text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">{msg.error}</span>
                    </MessageContent>
                  ) : (
                    <div className="space-y-2">
                      {(msg.agentTrace?.length ?? 0) > 0 ? (
                        <DesignAgentChainOfThought
                          assistantId={msg.id}
                          phases={msg.agentTrace!}
                          isStreaming={false}
                          chainOpen={chainOpenByAssistant[msg.id] ?? false}
                          onOpenChange={(open) =>
                            setChainOpenByAssistant((prev) => ({ ...prev, [msg.id]: open }))
                          }
                          streamTrace=""
                        />
                      ) : null}
                      <MessageContent>
                        <MarkdownRenderer markdown={msg.content} className="w-full !max-w-none" />
                      </MessageContent>
                      {((msg.citations?.length ?? 0) > 0 || (msg.sources?.length ?? 0) > 0) ? (
                        <InlineCitation>
                          {(msg.citations ?? []).map((c) => (
                            <InlineCitationCard key={`cit-${c.href}`}>
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
                          {(msg.sources ?? []).map((s) => (
                            <InlineCitationCard key={`src-${s.href}`}>
                              <InlineCitationCardTrigger sources={[s.href]} />
                              <InlineCitationCardBody>
                                <InlineCitationSource
                                  title={s.title}
                                  url={s.href}
                                  description="Source"
                                />
                              </InlineCitationCardBody>
                            </InlineCitationCard>
                          ))}
                        </InlineCitation>
                      ) : null}
                      <MessageActions className="w-fit items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/65">
                        <MessageAction
                          tooltip="Copy message"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          onClick={() => void handleCopyMessage(msg.id, msg.content)}
                        >
                          {copiedMessageId === msg.id ? (
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
                          onClick={() => void handleThumbRating(1)}
                        >
                          <ThumbsUp className="size-4" />
                        </MessageAction>
                        <MessageAction
                          tooltip="Not helpful"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => void handleThumbRating(-1)}
                        >
                          <ThumbsDown className="size-4" />
                        </MessageAction>
                      </MessageActions>
                    </div>
                  )}
                </Message>
              ))}
              {completionNotice ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs text-amber-900 dark:text-amber-200">{completionNotice.message}</p>
                  {completionNotice.actionPrompt ? (
                    <Button
                      className="h-7 rounded-lg px-2.5 text-xs"
                      onClick={() => {
                        setCompletionNotice(null)
                        void send(completionNotice.actionPrompt ?? "")
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Continue response
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {(() => {
                const last = messages[messages.length - 1]
                if (
                  !last ||
                  last.role !== "assistant" ||
                  last.isStreaming ||
                  last.error ||
                  followUpSuggestions.length === 0
                ) {
                  return null
                }
                return (
                  <Suggestions className="px-1 pt-1">
                    {followUpSuggestions.map((suggestionText) => (
                      <Suggestion
                        key={suggestionText}
                        className="font-normal text-foreground"
                        onClick={() => void send(suggestionText)}
                        suggestion={suggestionText}
                      >
                        <Sparkles size={16} />
                        {suggestionText}
                      </Suggestion>
                    ))}
                  </Suggestions>
                )
              })()}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t">
        <LayersPanel />
      </div>

      <div className="shrink-0 border-t p-3">
        <PromptInputProvider>
          <PromptInput maxFileSize={5 * 1024 * 1024} maxFiles={4} onSubmit={handleSubmit}>
            <DesignPromptAttachmentStrip />
            <PromptInputTextarea placeholder="Describe changes or a new design…" />
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
                  onValueChange={(value) => setDesignChatModel(value as MistralModel)}
                  value={designChatModel}
                  disabled={chatStatus === "streaming"}
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
                <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-2 py-1">
                  <Switch
                    id="design-agent-toggle"
                    checked={designAgentPipelineEnabled}
                    onCheckedChange={setDesignAgentPipelineEnabled}
                    disabled={chatStatus === "streaming"}
                  />
                  <Label htmlFor="design-agent-toggle" className="cursor-pointer text-xs text-muted-foreground">
                    Design agent
                  </Label>
                </div>
              </PromptInputTools>
              <PromptInputTools className="justify-end">
                <PromptInputSubmit
                  status={chatStatus === "streaming" ? "streaming" : "ready"}
                  onStop={handleStop}
                />
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  )
}
