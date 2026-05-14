import type { FileUIPart } from "ai"
import { streamChat, type StreamChatResult } from "@/lib/llm-service"
import type { LlmChatMessage } from "@/lib/llm-types"
import type { MockSource } from "@/lib/mock-chat-data"
import { extractJsonFromStream } from "./design-json-parser"
import { useDesignStore } from "../store/design-store"
import { buildDesignSystemPrompt } from "./design-prompt"

export type DesignCitation = { href: string; label: string }

export type DesignChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  error?: string
  /** From SSE `sources` / `citations` (e.g. grounded links in assistant text). */
  sources?: MockSource[]
  citations?: DesignCitation[]
}

export type DesignAssistantStreamMeta = {
  sources: MockSource[]
  citations: DesignCitation[]
}

export async function sendDesignMessage(options: {
  userMessage: string
  history: DesignChatMessage[]
  attachments?: FileUIPart[]
  onToken: (token: string) => void
  onComplete: (response: ReturnType<typeof extractJsonFromStream>, streamMeta: DesignAssistantStreamMeta) => void
  onStreamResult?: (result: StreamChatResult) => void
  onSuggestions?: (suggestions: string[]) => void
  onError: (msg: string) => void
  signal?: AbortSignal
}) {
  const {
    userMessage,
    history,
    attachments,
    onToken,
    onComplete: onParsed,
    onStreamResult,
    onSuggestions,
    onError,
    signal,
  } = options
  const { document, designChatModel } = useDesignStore.getState()

  const systemPrompt = buildDesignSystemPrompt(document)

  const messages: LlmChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history
      .filter((m) => !m.isStreaming && !m.error)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ]

  let buffer = ""
  const streamSources: MockSource[] = []
  const streamCitations: DesignCitation[] = []

  try {
    await streamChat({
      model: designChatModel,
      messages,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      temperature: 0.3,
      // Large design replies (full document JSON) need more headroom than chat; capped by api/chat MAX_TOKENS_CAP.
      maxTokens: 12_000,
      // Mistral JSON mode: strongly biases toward a single parseable JSON object.
      responseFormat: "json_object",
      // Same handler as main chat; avoids a separate serverless entry that can fail to bundle.
      // Large design payloads (esp. image data URLs) are stripped in buildDesignSystemPrompt.
      chatApiPath: "/api/chat",
      onToken: (token) => {
        buffer += token
        onToken(token)
      },
      onSuggestions,
      onSources: (sources) => {
        streamSources.length = 0
        streamSources.push(...sources)
      },
      onCitations: (citations) => {
        streamCitations.length = 0
        streamCitations.push(...citations)
      },
      onComplete: (result) => {
        const parsed = extractJsonFromStream(buffer)
        onParsed(parsed, {
          sources: [...streamSources],
          citations: [...streamCitations],
        })
        onStreamResult?.(result)
      },
      signal,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    onError(msg)
  }
}
