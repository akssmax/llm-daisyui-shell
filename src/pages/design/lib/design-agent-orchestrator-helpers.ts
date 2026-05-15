import { streamChat, type AgentPhaseSsePayload, type StreamChatResult } from "@/lib/llm-service"
import type { MistralModel } from "@/lib/llm-types"
import type { FileUIPart } from "ai"
import type { DesignAgentPhaseId, DesignAgentPhaseTrace } from "./design-agent-orchestrator"
import { parseJsonObjectFromModel } from "./design-agent-schemas"

export type PhaseRunResult = {
  raw: string
  trace: DesignAgentPhaseTrace
  stream: StreamChatResult
}

function summarizeJsonKeys(raw: string): string {
  const obj = parseJsonObjectFromModel(raw)
  if (!obj || typeof obj !== "object") return "Structured response"
  const keys = Object.keys(obj as Record<string, unknown>).slice(0, 8)
  return keys.length ? keys.join(", ") : "OK"
}

export async function runJsonPhase(options: {
  phaseId: DesignAgentPhaseId
  label: string
  systemPrompt: string
  userContent: string
  model: MistralModel
  maxTokens: number
  signal?: AbortSignal
  attachments?: FileUIPart[]
  onToken?: (t: string) => void
  onAgentPhase?: (p: AgentPhaseSsePayload) => void
  onPhaseBuffer?: (phaseId: DesignAgentPhaseId, buffer: string) => void
  onPhaseEnd?: (t: DesignAgentPhaseTrace) => void
}): Promise<PhaseRunResult> {
  const { phaseId, label, systemPrompt, userContent, model, maxTokens, signal, attachments, onToken, onAgentPhase, onPhaseBuffer, onPhaseEnd } = options
  const trace: DesignAgentPhaseTrace = { id: phaseId, label, summary: "", state: "running" }
  let buffer = ""
  const stream = await streamChat({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    temperature: 0.25,
    maxTokens,
    responseFormat: "json_object",
    designAgentPhase: phaseId,
    designAgentPhaseLabel: label,
    signal,
    onToken: (t) => {
      buffer += t
      onToken?.(t)
      onPhaseBuffer?.(phaseId, buffer)
    },
    onAgentPhase,
  })
  if (!buffer.trim()) {
    const failed: DesignAgentPhaseTrace = {
      ...trace,
      state: "error",
      summary: "Empty model response (no streamed text)",
      rawJson: "",
    }
    onPhaseEnd?.(failed)
    return { raw: "", trace: failed, stream }
  }
  const truncatedNote =
    stream.finishReason === "length" || stream.completionStatus === "max_tokens_reached"
      ? " (output limit reached)"
      : ""
  const done: DesignAgentPhaseTrace = {
    ...trace,
    state: "complete",
    summary: `${summarizeJsonKeys(buffer)}${truncatedNote}`,
    rawJson: buffer.trim().length > 120_000 ? `${buffer.slice(0, 120_000)}\n…[truncated]` : buffer,
  }
  onPhaseEnd?.(done)
  return { raw: buffer, trace: done, stream }
}
