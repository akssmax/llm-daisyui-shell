import type { FileUIPart } from "ai"

export const MISTRAL_MODELS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
] as const

export type MistralModel = (typeof MISTRAL_MODELS)[number]

export type ChatCompletionStatus =
  | "completed"
  | "max_tokens_reached"
  | "timeout"
  | "upstream_error"
  | "aborted_by_user"

export interface LlmChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LlmChatRequest {
  model: MistralModel
  messages: LlmChatMessage[]
  attachments?: FileUIPart[]
  temperature?: number
  maxTokens?: number
  memoryContext?: string
  retrievedContext?: string
  sessionSummary?: string
  /** When set, `/api/chat` forwards Mistral `response_format` (design JSON only). */
  responseFormat?: "json_object"
  /** Emits SSE `agent_phase` boundaries for design agent orchestration UI. */
  designAgentPhase?: string
  designAgentPhaseLabel?: string
}

