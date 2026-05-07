import type { ChatCompletionStatus, LlmChatRequest } from "@/lib/llm-types"
import type { MockAssistantMeta, MockSource } from "@/lib/mock-chat-data"

type Citation = NonNullable<MockAssistantMeta["citations"]>[number]
type ReasoningMeta = NonNullable<MockAssistantMeta["reasoning"]>
type StreamDonePayload = {
  status?: ChatCompletionStatus
  finishReason?: string
  maxTokens?: number
}

export type StreamChatResult = {
  completionStatus: ChatCompletionStatus
  emittedTokens: number
  finishReason?: string
  maxTokens?: number
}

export interface StreamChatOptions extends LlmChatRequest {
  onToken: (token: string) => void
  onSuggestions?: (suggestions: string[]) => void
  onReasoning?: (reasoning: ReasoningMeta) => void
  onSources?: (sources: MockSource[]) => void
  onCitations?: (citations: Citation[]) => void
  onComplete?: (result: StreamChatResult) => void
  signal?: AbortSignal
}

const RETRY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryStatus(status: number): boolean {
  return status >= 500
}

function parseSseEvent(rawEvent: string): { event: string; data: string } | null {
  const lines = rawEvent
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)

  if (lines.length === 0) return null

  let event = "message"
  const dataParts: string[] = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim()
    } else if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trim())
    }
  }

  return {
    data: dataParts.join("\n"),
    event,
  }
}

async function streamSseResponse(
  response: Response,
  onToken: (token: string) => void,
  onSuggestions?: (suggestions: string[]) => void,
  onReasoning?: (reasoning: ReasoningMeta) => void,
  onSources?: (sources: MockSource[]) => void,
  onCitations?: (citations: Citation[]) => void
): Promise<StreamDonePayload | null> {
  if (!response.body) {
    throw new Error("Missing response body from /api/chat")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let donePayload: StreamDonePayload | null = null
  const processEvent = (rawEvent: string) => {
    const parsed = parseSseEvent(rawEvent)
    if (!parsed) return

    if (parsed.event === "token") {
      try {
        const payload = JSON.parse(parsed.data) as { text?: string }
        if (payload.text) onToken(payload.text)
      } catch {
        // Ignore malformed token payloads.
      }
    } else if (parsed.event === "suggestions") {
      try {
        const payload = JSON.parse(parsed.data) as { suggestions?: unknown }
        if (!Array.isArray(payload.suggestions)) return
        const suggestions = payload.suggestions.filter((item): item is string => typeof item === "string")
        if (suggestions.length > 0) {
          onSuggestions?.(suggestions)
        }
      } catch {
        // Ignore malformed suggestions payloads.
      }
    } else if (parsed.event === "reasoning") {
      try {
        const payload = JSON.parse(parsed.data) as { reasoning?: { content?: unknown; durationSeconds?: unknown } }
        if (typeof payload.reasoning?.content !== "string" || !payload.reasoning.content.trim()) return
        onReasoning?.({
          content: payload.reasoning.content,
          durationSeconds:
            typeof payload.reasoning.durationSeconds === "number"
              ? payload.reasoning.durationSeconds
              : undefined,
        })
      } catch {
        // Ignore malformed reasoning payloads.
      }
    } else if (parsed.event === "sources") {
      try {
        const payload = JSON.parse(parsed.data) as { sources?: unknown }
        if (!Array.isArray(payload.sources)) return
        const sources = payload.sources
          .filter(
            (item): item is MockSource =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as MockSource).href === "string" &&
              typeof (item as MockSource).title === "string"
          )
          .filter((source) => source.href.trim().length > 0 && source.title.trim().length > 0)
        if (sources.length > 0) onSources?.(sources)
      } catch {
        // Ignore malformed sources payloads.
      }
    } else if (parsed.event === "citations") {
      try {
        const payload = JSON.parse(parsed.data) as { citations?: unknown }
        if (!Array.isArray(payload.citations)) return
        const citations = payload.citations
          .filter(
            (item): item is Citation =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as Citation).href === "string" &&
              typeof (item as Citation).label === "string"
          )
          .filter((citation) => citation.href.trim().length > 0 && citation.label.trim().length > 0)
        if (citations.length > 0) onCitations?.(citations)
      } catch {
        // Ignore malformed citations payloads.
      }
    } else if (parsed.event === "error") {
      try {
        const payload = JSON.parse(parsed.data) as { message?: string }
        throw new Error(payload.message || "Streaming failed")
      } catch (error) {
        if (error instanceof Error) throw error
        throw new Error("Streaming failed")
      }
    } else if (parsed.event === "done") {
      try {
        const payload = JSON.parse(parsed.data) as StreamDonePayload
        donePayload = payload
      } catch {
        // Ignore malformed done payloads.
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      // Flush any trailing event when stream closes without delimiter.
      const trailingEvent = buffer.trim()
      if (trailingEvent) {
        processEvent(trailingEvent)
      }
      break
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")

    let separatorIndex = buffer.indexOf("\n\n")
    while (separatorIndex !== -1) {
      const chunk = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      processEvent(chunk)

      separatorIndex = buffer.indexOf("\n\n")
    }
  }

  return donePayload
}

async function requestChat(
  payload: LlmChatRequest,
  signal: AbortSignal | undefined,
  onToken: (token: string) => void,
  onSuggestions?: (suggestions: string[]) => void,
  onReasoning?: (reasoning: ReasoningMeta) => void,
  onSources?: (sources: MockSource[]) => void,
  onCitations?: (citations: Citation[]) => void
): Promise<StreamChatResult> {
  const response = await fetch("/api/chat", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    if (response.status === 404) {
      throw new Error(
        "API route /api/chat not found. Run the app with `vercel dev` so serverless functions are available."
      )
    }
    throw new Error(
      `Request failed (${response.status}): ${errorText || response.statusText || "Unknown error"}`
    )
  }

  let tokenCount = 0
  const donePayload = await streamSseResponse(
    response,
    (token) => {
      tokenCount += 1
      onToken(token)
    },
    onSuggestions,
    onReasoning,
    onSources,
    onCitations
  )

  return {
    completionStatus: donePayload?.status ?? "completed",
    emittedTokens: tokenCount,
    finishReason: donePayload?.finishReason,
    maxTokens: donePayload?.maxTokens,
  }
}

export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  const {
    onToken,
    onSuggestions,
    onReasoning,
    onSources,
    onCitations,
    onComplete,
    signal,
    ...payload
  } = options

  try {
    const result = await requestChat(payload, signal, onToken, onSuggestions, onReasoning, onSources, onCitations)
    onComplete?.(result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isNetworkError = error instanceof TypeError
    const statusMatch = errorMessage.match(/Request failed \((\d+)\):/)
    const status = statusMatch ? Number(statusMatch[1]) : NaN
    const shouldRetry = isNetworkError || (Number.isFinite(status) && shouldRetryStatus(status))

    if (!shouldRetry) throw error

    await sleep(RETRY_DELAY_MS)
    const result = await requestChat(payload, signal, onToken, onSuggestions, onReasoning, onSources, onCitations)
    onComplete?.(result)
    return result
  }
}

