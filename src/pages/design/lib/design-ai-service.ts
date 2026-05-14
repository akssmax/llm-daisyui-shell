import type { FileUIPart } from "ai"
import { streamChat, type AgentPhaseSsePayload, type StreamChatResult } from "@/lib/llm-service"
import type { LlmChatMessage } from "@/lib/llm-types"
import type { MockSource } from "@/lib/mock-chat-data"
import { extractJsonFromStream } from "./design-json-parser"
import { useDesignStore } from "../store/design-store"
import { buildDesignSystemPrompt } from "./design-prompt"
import { runDesignAgentTurn, type DesignAgentPhaseTrace } from "./design-agent-orchestrator"

export type DesignCitation = { href: string; label: string }

export type DesignChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  /** Snapshot at send time: multi-phase agent vs single JSON completion. */
  agentPipelineForTurn?: boolean
  /** Snapshot of files sent with this user turn (for transcript UI). */
  attachments?: (FileUIPart & { id: string })[]
  isStreaming?: boolean
  error?: string
  /** From SSE `sources` / `citations` (e.g. grounded links in assistant text). */
  sources?: MockSource[]
  citations?: DesignCitation[]
  /** Slim trace of multi-phase agent (summaries + optional raw JSON per phase). */
  agentTrace?: DesignAgentPhaseTrace[]
}

export type DesignAssistantStreamMeta = {
  sources: MockSource[]
  citations: DesignCitation[]
  agentTrace?: DesignAgentPhaseTrace[]
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
  /**
   * When set, selects agent vs one-shot for this request (must match UI for this assistant turn).
   * If omitted, reads `designAgentPipelineEnabled` from the design store.
   */
  agentPipelineForTurn?: boolean
  /** SSE `agent_phase` events (when phase id is sent to `/api/chat`). */
  onAgentPhase?: (payload: AgentPhaseSsePayload) => void
  /** After each design-agent phase completes (browser orchestrator). */
  onDesignAgentPhase?: (trace: DesignAgentPhaseTrace) => void
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
    agentPipelineForTurn: agentPipelineForTurnOption,
    onAgentPhase,
    onDesignAgentPhase,
  } = options
  const { document, designChatModel, designAgentPipelineEnabled } = useDesignStore.getState()
  const agentPipelineForTurn = agentPipelineForTurnOption ?? designAgentPipelineEnabled

  if (agentPipelineForTurn) {
    try {
      const { response, phases } = await runDesignAgentTurn({
        userMessage,
        attachments,
        signal,
        model: designChatModel,
        onAgentPhase,
        onPhaseComplete: onDesignAgentPhase,
      })
      onParsed(response, { sources: [], citations: [], agentTrace: phases })
      onStreamResult?.({
        completionStatus: "completed",
        emittedTokens: 0,
        finishReason: "stop",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      onError(msg)
    }
    return
  }

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
      maxTokens: 12_000,
      responseFormat: "json_object",
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
