"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { FileUIPart } from "ai"

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
import { AGENT_AVATAR_SHAPES } from "@/components/chat/agent-shape-avatar"
import { VirtualizedConversationMessages } from "@/components/chat/virtualized-conversation-messages"
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemDescription,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { streamChat } from "@/lib/llm-service"
import type { ChatThread, PendingQueueItem } from "@/lib/chat-threads"
import { buildMemoryContext, type UserMemory } from "@/lib/user-memory"
import { buildRetrievedContext, searchRagMemory } from "@/lib/rag-memory"
import { getRetrievalDecision } from "@/lib/retrieval-gating"
import { nanoid } from "nanoid"
import { MISTRAL_MODELS, type ChatCompletionStatus, type MistralModel } from "@/lib/llm-types"
import type { MemorySourceEntry, MockChatItem, MockToolCall } from "@/lib/mock-chat-data"
import {
  estimateTokenCount,
  getMessageText,
  replaceMessageById,
  toTextMessage,
} from "@/lib/chat-message-utils"

import { Brain, Lightbulb, ListOrdered, Mic, Plus, Sparkles, Trash2 } from "lucide-react"

type ChatStatus = "ready" | "submitted" | "streaming" | "error"
type CompletionNotice = {
  actionPrompt?: string
  message: string
  status: ChatCompletionStatus
}

const EMPTY_PENDING_QUEUE: PendingQueueItem[] = []

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
const CONTINUE_RESPONSE_PROMPT = "Continue from where you left off and complete the previous answer."

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

function summarizeMessagesForSession(messages: MockChatItem[]): string {
  const history = messages
    .slice(-24)
    .map((item) => {
      const role = item.message.role.toUpperCase()
      const text = getMessageText(item.message).trim()
      if (!text) return null
      return `${role}: ${text.slice(0, 280)}`
    })
    .filter((line): line is string => Boolean(line))
  return history.join("\n")
}

function extractMemoryFromPrompt(text: string): { category: "profile" | "preferences" | "facts"; value: string } | null {
  const prompt = text.trim()
  if (!prompt) return null

  const nameMatch =
    prompt.match(/(?:remember\s+that\s+)?my\s+name\s+is\s+([a-z][a-z\s'-]{1,40})/i) ||
    prompt.match(/remember\s+me\s+as\s+([a-z][a-z\s'-]{1,40})/i)
  if (nameMatch?.[1]) {
    return {
      category: "profile",
      value: `Name: ${nameMatch[1].trim()}`,
    }
  }

  const prefMatch = prompt.match(/(?:i\s+prefer|remember\s+that\s+i\s+prefer)\s+(.{3,120})/i)
  if (prefMatch?.[1]) {
    return {
      category: "preferences",
      value: prefMatch[1].trim(),
    }
  }

  const factMatch = prompt.match(/remember\s+that\s+(.{3,180})/i)
  if (factMatch?.[1]) {
    return {
      category: "facts",
      value: factMatch[1].trim(),
    }
  }

  return null
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
  globalMemory,
  onSaveGlobalMemory,
}: {
  className?: string
  thread: ChatThread
  onUpdateThread: (threadId: string, updater: (thread: ChatThread) => ChatThread) => void
  globalMemory: UserMemory
  onSaveGlobalMemory: (next: Partial<UserMemory>) => void
}) {
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [text, setText] = useState("")
  const [activeBranch, setActiveBranch] = useState<Record<string, number>>({})
  const [selectedModel, setSelectedModel] = useState<MistralModel>("mistral-small-latest")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [llmSuggestions, setLlmSuggestions] = useState<string[]>([])
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [chainOfThoughtOpen, setChainOfThoughtOpen] = useState<Record<string, boolean>>({})
  const [emptyStateActions, setEmptyStateActions] = useState<EmptyStateAction[]>(() =>
    pickRandomEmptyStateActions(EMPTY_STATE_PROMPT_POOL, EMPTY_STATE_PROMPT_COUNT)
  )
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false)
  const [sourcePanelItems, setSourcePanelItems] = useState<MemorySourceEntry[]>([])
  const [sourcePanelTitle, setSourcePanelTitle] = useState("Sources")
  const [completionNotice, setCompletionNotice] = useState<CompletionNotice | null>(null)
  const processingQueueRef = useRef(false)
  const thoughtStartMsRef = useRef<Record<string, number>>({})
  const liveAgentShape = useMemo(() => {
    const id = thread.threadId || "default"
    let hash = 0
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0
    }
    return AGENT_AVATAR_SHAPES[hash % AGENT_AVATAR_SHAPES.length] ?? "Circle"
  }, [thread.threadId])
  const messages = thread.messages
  const messagesRef = useRef(messages)
  const pendingQueue = thread.pendingQueue ?? EMPTY_PENDING_QUEUE

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const threadTokenTotal = useMemo(() => {
    return messages.reduce((total, item) => {
      return (
        total +
        (item.contentTokenEstimate ?? estimateTokenCount(getMessageText(item.message)))
      )
    }, 0)
  }, [messages])

  const contextMetrics = useMemo(() => {
    const inputTokens = estimateTokenCount(text)
    const usedTokens = inputTokens + threadTokenTotal
    const maxTokens = MODEL_CONTEXT_LIMITS[selectedModel] ?? 8192

    return {
      maxTokens,
      usedTokens,
    }
  }, [selectedModel, text, threadTokenTotal])

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
    setChainOfThoughtOpen({})
    setActiveBranch({})
    setCompletionNotice(null)
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

  const runMessage = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim())
      const hasFiles = Boolean(message.files?.length)
      if (!hasText && !hasFiles) return

      setStatus("submitted")

      const userId = `u-${Date.now()}`
      const userText = message.text || (hasFiles ? "Sent with attachments" : "")
      const isFirstUserMessage = messagesRef.current.every((item) => item.message.role !== "user")

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
          contentTokenEstimate: estimateTokenCount(userText),
        },
      ])

      setText("")
      setLlmSuggestions([])
      setCompletionNotice(null)
      setStatus("streaming")

      const assistantId = `a-${Date.now()}`
      const assistantItem = {
        id: assistantId,
        message: toTextMessage(assistantId, "assistant", ""),
        meta: {},
        contentTokenEstimate: 0,
      }
      thoughtStartMsRef.current[assistantId] = Date.now()

      updateThreadMessages((prev) => [...prev, assistantItem])

      const controller = new AbortController()
      setAbortController(controller)
      let tokenBuffer = ""
      let rafId: number | null = null

      const history = [
        ...messagesRef.current.map((item) => ({
          content: getMessageText(item.message),
          role: item.message.role,
        })),
        { content: userText, role: "user" as const },
      ]
      const pendingToolCalls: MockToolCall[] = []
      const resolvedToolCalls: MockToolCall[] = []
      const memorySourceEntries: MemorySourceEntry[] = []
      const memoryEnabled = thread.useMemory !== false
      const retrievalDecision = getRetrievalDecision(userText, {
        retrievalEnabled: globalMemory.retrievalEnabled,
        retrievalMode: globalMemory.retrievalMode,
      })
      const memoryContext = memoryEnabled
        ? retrievalDecision.shouldUseMemory
          ? buildMemoryContext(globalMemory, thread.threadMemory ?? "")
          : ""
        : ""
      if (memoryEnabled && retrievalDecision.shouldUseMemory && memoryContext.trim().length > 0) {
        pendingToolCalls.push({
          name: "get_memory",
          description: "Load user and thread memory",
          state: "input-available",
          input: { scope: "global+thread" },
        })
        resolvedToolCalls.push({
          name: "get_memory",
          description: "Load user and thread memory",
          state: "output-available",
          output: { loaded: true },
        })
        memorySourceEntries.push({
          id: `memory-${assistantId}`,
          kind: "memory",
          title: "Saved memory context",
          description: memoryContext.trim().slice(0, 240),
        })
      }
      const ragResults = retrievalDecision.shouldUseRag
        ? searchRagMemory({ query: userText, threadId: thread.threadId, limit: 4 })
        : []
      const retrievedContext = buildRetrievedContext(ragResults)
      if (retrievalDecision.shouldUseRag && ragResults.length > 0) {
        pendingToolCalls.push({
          name: "search_memory",
          description: "Search retrieval memory (global + thread)",
          state: "input-available",
          input: { query: userText },
        })
        resolvedToolCalls.push({
          name: "search_memory",
          description: "Search retrieval memory (global + thread)",
          state: "output-available",
          output: { matches: ragResults.length },
        })
        for (const [index, result] of ragResults.entries()) {
          memorySourceEntries.push({
            id: `rag-${assistantId}-${index}`,
            kind: "rag",
            title: result.sourceName,
            description: result.text.slice(0, 240),
          })
        }
      }

      const extractedMemory = extractMemoryFromPrompt(userText)
      if (extractedMemory) {
        if (extractedMemory.category === "profile") {
          onSaveGlobalMemory({
            profile: [globalMemory.profile, extractedMemory.value].filter(Boolean).join("\n").trim(),
          })
        } else if (extractedMemory.category === "preferences") {
          onSaveGlobalMemory({
            preferences: [globalMemory.preferences, extractedMemory.value].filter(Boolean).join("\n").trim(),
          })
        } else {
          onSaveGlobalMemory({
            facts: [globalMemory.facts, extractedMemory.value].filter(Boolean).join("\n").trim(),
          })
        }
        pendingToolCalls.push({
          name: "save_memory",
          description: "Persist long-term user memory",
          state: "input-available",
          input: { category: extractedMemory.category },
        })
        resolvedToolCalls.push({
          name: "save_memory",
          description: "Persist long-term user memory",
          state: "output-available",
          output: { category: extractedMemory.category, saved: true },
        })
        memorySourceEntries.push({
          id: `saved-${assistantId}`,
          kind: "memory",
          title: "Saved memory",
          description: extractedMemory.value,
        })
      }

      let sessionSummary = thread.sessionSummary ?? ""
      const estimatedTokens = estimateTokenCount(history.map((item) => item.content).join("\n"))
      if (estimatedTokens > 4000) {
        sessionSummary = summarizeMessagesForSession(messagesRef.current)
        onUpdateThread(thread.threadId, (current) => ({
          ...current,
          sessionSummary,
        }))
        pendingToolCalls.push({
          name: "summarize_conversation",
          description: "Summarize older conversation context",
          state: "input-available",
          input: { trigger: "context_limit" },
        })
        resolvedToolCalls.push({
          name: "summarize_conversation",
          description: "Summarize older conversation context",
          state: "output-available",
          output: { summaryLength: sessionSummary.length },
        })
      }
      const setAssistantTools = (tools: MockToolCall[]) => {
        updateThreadMessages((prev) =>
          replaceMessageById(prev, assistantId, (item) => ({
            ...item,
            meta: {
              ...(item.meta ?? {}),
              tools: tools.length > 0 ? tools : item.meta?.tools,
              memorySources: memorySourceEntries.length > 0 ? memorySourceEntries : item.meta?.memorySources,
            },
          }))
        )
      }
      const hasToolCalls = pendingToolCalls.length > 0 || resolvedToolCalls.length > 0
      if (hasToolCalls || memorySourceEntries.length > 0) {
        setChainOfThoughtOpen((prev) => ({ ...prev, [assistantId]: true }))
        setAssistantTools(pendingToolCalls)
      }
      const finalizeThoughtDuration = () => {
        const startedMs = thoughtStartMsRef.current[assistantId]
        if (!startedMs) return
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedMs) / 1000))
        delete thoughtStartMsRef.current[assistantId]
        updateThreadMessages((prev) =>
          replaceMessageById(prev, assistantId, (it) => ({
            ...it,
            meta: {
              ...(it.meta ?? {}),
              reasoning: {
                content: it.meta?.reasoning?.content ?? "",
                durationSeconds,
              },
            },
          }))
        )
      }
      const scheduleChainClose = () => {
        window.setTimeout(() => {
          setChainOfThoughtOpen((prev) => ({ ...prev, [assistantId]: false }))
        }, 900)
      }
      const finalizeToolCalls = (errorText?: string) => {
        if (!hasToolCalls) return
        if (errorText) {
          setAssistantTools(
            pendingToolCalls.map((tool) => ({
              ...tool,
              error: errorText,
              state: "output-error",
            }))
          )
          return
        }
        setAssistantTools(resolvedToolCalls)
      }
      const flushBufferedTokens = () => {
        if (!tokenBuffer) return
        const chunk = tokenBuffer
        tokenBuffer = ""
        updateThreadMessages((prev) => {
          const lastIndex = prev.length - 1
          const last = prev[lastIndex]
          if (!last || last.id !== assistantId) {
            return replaceMessageById(prev, assistantId, (it) => {
              const nextText = `${getMessageText(it.message)}${chunk}`
              return {
                ...it,
                message: toTextMessage(it.message.id, "assistant", nextText),
                contentTokenEstimate: estimateTokenCount(nextText),
              }
            })
          }
          const previous = getMessageText(last.message)
          const nextText = `${previous}${chunk}`
          const next = prev.slice()
          next[lastIndex] = {
            ...last,
            message: toTextMessage(last.message.id, "assistant", nextText),
            contentTokenEstimate: estimateTokenCount(nextText),
          }
          return next
        })
      }
      const scheduleTokenFlush = () => {
        if (rafId !== null) return
        rafId = window.requestAnimationFrame(() => {
          rafId = null
          flushBufferedTokens()
        })
      }

      try {
        const streamResult = await streamChat({
          attachments: message.files,
          messages: history,
          memoryContext,
          retrievedContext,
          sessionSummary,
          model: selectedModel,
          onToken: (chunk) => {
            tokenBuffer += chunk
            scheduleTokenFlush()
          },
          onSuggestions: (suggestions) => {
            setLlmSuggestions(suggestions)
          },
          onReasoning: (reasoning) => {
            updateThreadMessages((prev) =>
              replaceMessageById(prev, assistantId, (it) => ({
                ...it,
                meta: { ...(it.meta ?? {}), reasoning },
              }))
            )
          },
          onSources: (sources) => {
            updateThreadMessages((prev) =>
              replaceMessageById(prev, assistantId, (it) => ({
                ...it,
                meta: { ...(it.meta ?? {}), sources },
              }))
            )
          },
          onCitations: (citations) => {
            updateThreadMessages((prev) =>
              replaceMessageById(prev, assistantId, (it) => ({
                ...it,
                meta: { ...(it.meta ?? {}), citations },
              }))
            )
          },
          onComplete: (result) => {
            if (result.completionStatus === "max_tokens_reached") {
              setCompletionNotice({
                actionPrompt: CONTINUE_RESPONSE_PROMPT,
                message:
                  "Response reached the output token limit and was truncated. Continue to get the rest.",
                status: "max_tokens_reached",
              })
            }
          },
          signal: controller.signal,
          temperature: 0.7,
        })
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId)
          rafId = null
        }
        flushBufferedTokens()
        if (streamResult.completionStatus === "max_tokens_reached") {
          setLlmSuggestions((prev) => {
            if (prev.includes(CONTINUE_RESPONSE_PROMPT)) return prev
            return [CONTINUE_RESPONSE_PROMPT, ...prev]
          })
        }
        finalizeToolCalls()
        finalizeThoughtDuration()
        scheduleChainClose()
        setStatus("ready")
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError")
        if (isAbort) {
          if (rafId !== null) {
            window.cancelAnimationFrame(rafId)
            rafId = null
          }
          flushBufferedTokens()
          finalizeToolCalls("Cancelled")
          finalizeThoughtDuration()
          scheduleChainClose()
          setStatus("ready")
          return
        }
        const errorMessage = error instanceof Error ? error.message : "Failed to get response."
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId)
          rafId = null
        }
        flushBufferedTokens()
        finalizeToolCalls(errorMessage)
        setCompletionNotice({
          message: errorMessage.includes("timed out")
            ? "The model request timed out before completion."
            : "Streaming failed before completion. Try continuing the response.",
          status: errorMessage.includes("timed out") ? "timeout" : "upstream_error",
        })
        finalizeThoughtDuration()
        scheduleChainClose()
        updateThreadMessages((prev) =>
          replaceMessageById(prev, assistantId, (it) => {
            const errText = `Unable to complete response: ${errorMessage}`
            return {
              ...it,
              message: toTextMessage(it.message.id, "assistant", errText),
              contentTokenEstimate: estimateTokenCount(errText),
            }
          })
        )
        setStatus("error")
      } finally {
        setAbortController(null)
      }
    },
    [
      globalMemory.facts,
      globalMemory.preferences,
      globalMemory.profile,
      globalMemory.retrievalEnabled,
      globalMemory.retrievalMode,
      onSaveGlobalMemory,
      onUpdateThread,
      refineChatTitle,
      selectedModel,
      thread.threadId,
      thread.useMemory,
      thread.threadMemory,
      updateThreadMessages,
    ]
  )

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim())
      const hasFiles = Boolean(message.files?.length)
      if (!hasText && !hasFiles) return

      const isBusy = status === "submitted" || status === "streaming"
      const queueLen = thread.pendingQueue?.length ?? 0
      if (!isBusy && queueLen === 0) {
        void runMessage(message)
        return
      }

      const userText = message.text?.trim() || (hasFiles ? "Sent with attachments" : "")
      onUpdateThread(thread.threadId, (current) => ({
        ...current,
        pendingQueue: [
          ...(current.pendingQueue ?? []),
          {
            id: `q-${Date.now()}-${nanoid(8)}`,
            text: userText,
            files: [...(message.files ?? [])] as FileUIPart[],
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      // Keep input usable while streaming by clearing local controlled text
      // when a prompt is queued instead of immediately executed.
      setText("")
    },
    [onUpdateThread, runMessage, status, thread.pendingQueue, thread.threadId]
  )

  useEffect(() => {
    const isBusy = status === "submitted" || status === "streaming"
    if (isBusy) return
    if (pendingQueue.length === 0) return
    if (processingQueueRef.current) return

    processingQueueRef.current = true
    const head = pendingQueue[0]
    const rest = pendingQueue.slice(1)
    onUpdateThread(thread.threadId, (current) => ({
      ...current,
      pendingQueue: rest,
    }))

    const payload: PromptInputMessage = {
      text: head.text,
      files: head.files,
    }

    void runMessage(payload).finally(() => {
      processingQueueRef.current = false
    })
  }, [onUpdateThread, pendingQueue, runMessage, status, thread.threadId])

  const removeFromQueue = useCallback(
    (itemId: string) => {
      onUpdateThread(thread.threadId, (current) => ({
        ...current,
        pendingQueue: (current.pendingQueue ?? []).filter((item) => item.id !== itemId),
      }))
    },
    [onUpdateThread, thread.threadId]
  )

  const stopStreaming = useCallback(() => {
    abortController?.abort()
  }, [abortController])

  const handleBranchChange = useCallback((messageId: string, branch: number) => {
    setActiveBranch((prev) => ({ ...prev, [messageId]: branch }))
  }, [])

  const handleChainOpenChange = useCallback((messageId: string, open: boolean) => {
    setChainOfThoughtOpen((prev) => ({ ...prev, [messageId]: open }))
  }, [])

  const handleMessageCopy = useCallback((messageId: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedMessageId(messageId)
    window.setTimeout(() => {
      setCopiedMessageId((current) => (current === messageId ? null : current))
    }, 1600)
  }, [])

  const handleOpenMemorySources = useCallback((items: MemorySourceEntry[]) => {
    setSourcePanelItems(items)
    setSourcePanelTitle("Sources")
    setSourcePanelOpen(true)
  }, [])

  const handleSuggestionClick = useCallback(
    (suggestionText: string) => {
      handleSubmit({ text: suggestionText, files: [] })
    },
    [handleSubmit]
  )

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Top helper strip to showcase non-message components */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300 bg-base-200 px-4">
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
                  {assistant?.meta?.context?.value ?? "No active context"}
                </div>
              </ContextContentBody>
            </ContextContent>
          </Context>
        </div>
      </div>

      <Conversation>
        <ConversationContent
          className={cn(
            "px-0 py-4",
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
            <VirtualizedConversationMessages
              messages={messages}
              latestAssistantMessageId={latestAssistantMessageId}
              activeBranch={activeBranch}
              status={status}
              chainOfThoughtOpen={chainOfThoughtOpen}
              liveAgentShape={liveAgentShape}
              llmSuggestions={llmSuggestions}
              copiedMessageId={copiedMessageId}
              onBranchChange={handleBranchChange}
              onChainOpenChange={handleChainOpenChange}
              onCopy={handleMessageCopy}
              onSuggestionClick={handleSuggestionClick}
              onOpenMemorySources={handleOpenMemorySources}
            />
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-base-300 bg-background">
        <div className="mx-auto grid max-w-3xl gap-3 p-4">
          {/* Plan is intentionally hidden for now; queue lives above the prompt input. */}
          {pendingQueue.length > 0 ? (
            <Queue>
              <div className="flex items-start gap-2">
                <QueueSection defaultOpen className="min-w-0 flex-1">
                  <QueueSectionTrigger className="w-full">
                    <QueueSectionLabel
                      count={pendingQueue.length}
                      icon={<ListOrdered className="size-4" />}
                      label="queued"
                    />
                  </QueueSectionTrigger>
                  <QueueSectionContent>
                    <QueueList>
                      {status === "submitted" || status === "streaming" ? (
                        <QueueItem className="flex flex-row items-start gap-2 bg-muted/40 py-2">
                          <QueueItemIndicator />
                          <QueueItemContent className="text-foreground">
                            Generating response...
                          </QueueItemContent>
                        </QueueItem>
                      ) : null}
                      {pendingQueue.map((item) => (
                        <QueueItem
                          key={item.id}
                          className="flex flex-row items-start gap-2 py-2"
                        >
                          <QueueItemIndicator />
                          <div className="min-w-0 flex-1 text-left">
                            <QueueItemContent className="text-foreground">
                              {item.text || "Sent with attachments"}
                            </QueueItemContent>
                            {item.files.length > 0 ? (
                              <QueueItemDescription>
                                {item.files.length} file(s)
                              </QueueItemDescription>
                            ) : null}
                          </div>
                          <QueueItemActions className="shrink-0 self-center">
                            <QueueItemAction
                              aria-label="Remove from queue"
                              onClick={() => removeFromQueue(item.id)}
                              type="button"
                            >
                              <Trash2 className="size-3.5" />
                            </QueueItemAction>
                          </QueueItemActions>
                        </QueueItem>
                      ))}
                    </QueueList>
                  </QueueSectionContent>
                </QueueSection>
                {status === "submitted" || status === "streaming" ? (
                  <Button
                    className="shrink-0 rounded-xl"
                    onClick={stopStreaming}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Stop
                  </Button>
                ) : null}
              </div>
            </Queue>
          ) : null}

          {completionNotice ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                {completionNotice.message}
              </p>
              {completionNotice.actionPrompt ? (
                <Button
                  className="h-7 rounded-lg px-2.5 text-xs"
                  onClick={() => handleSuggestionClick(completionNotice.actionPrompt ?? "")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Continue response
                </Button>
              ) : null}
            </div>
          ) : null}

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
                  <PromptInputSubmit />
                </PromptInputTools>
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>

          {/* Attachments preview is intentionally hidden for now.
              It will move into the chat input box component later. */}

        </div>
      </div>
      <Sheet open={sourcePanelOpen} onOpenChange={setSourcePanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{sourcePanelTitle}</SheetTitle>
            <SheetDescription>
              Memory and retrieval sources used for this response.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-4">
            {sourcePanelItems.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
              </div>
            ))}
            {sourcePanelItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources available for this response.</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

