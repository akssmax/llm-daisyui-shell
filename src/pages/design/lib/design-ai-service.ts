import type { FileUIPart } from "ai"
import { streamChat, type StreamChatResult } from "@/lib/llm-service"
import type { LlmChatMessage } from "@/lib/llm-types"
import { extractJsonFromStream } from "./design-json-parser"
import { useDesignStore } from "../store/design-store"
import { buildDesignSystemPrompt } from "./design-prompt"

export type DesignChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  error?: string
}

export async function sendDesignMessage(options: {
  userMessage: string
  history: DesignChatMessage[]
  attachments?: FileUIPart[]
  onToken: (token: string) => void
  onComplete: (response: ReturnType<typeof extractJsonFromStream>) => void
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

  try {
    await streamChat({
      model: designChatModel,
      messages,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      temperature: 0.3,
      // Keep output budget modest so /api/design-chat finishes within Vercel maxDuration (streaming).
      maxTokens: 4096,
      chatApiPath: "/api/design-chat",
      onToken: (token) => {
        buffer += token
        onToken(token)
      },
      onSuggestions,
      onComplete: (result) => {
        const parsed = extractJsonFromStream(buffer)
        onParsed(parsed)
        onStreamResult?.(result)
      },
      signal,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    onError(msg)
  }
}
