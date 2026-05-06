import type { FileUIPart } from "ai"

export const MISTRAL_MODELS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
] as const

export type MistralModel = (typeof MISTRAL_MODELS)[number]

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
}

