import type { MockToolCall } from "@/lib/mock-chat-data"

function toChainStepStatus(state: MockToolCall["state"]): "complete" | "active" | "pending" {
  if (state === "output-available") return "complete"
  if (state === "output-error" || state === "output-denied") return "pending"
  return "active"
}

export type UnifiedTraceStep = {
  id: string
  label: string
  description?: string
  status: "complete" | "active" | "pending"
  sources?: string[]
}

export function buildUnifiedTraceSteps(params: {
  itemId: string
  reasoning?: string
  tools?: MockToolCall[]
  sources?: string[]
  isStreaming: boolean
  hasAssistantText: boolean
}): UnifiedTraceStep[] {
  const { itemId, reasoning, tools, sources, isStreaming, hasAssistantText } = params
  const steps: UnifiedTraceStep[] = []

  if (reasoning?.trim()) {
    steps.push({
      id: `${itemId}-reasoning`,
      label: "Understanding request",
      description: reasoning.trim().slice(0, 220),
      status: "complete",
    })
  }

  if (tools?.length) {
    for (const [index, tool] of tools.entries()) {
      steps.push({
        id: `${itemId}-tool-${index}`,
        label: tool.description || tool.name,
        description:
          tool.state === "output-available"
            ? "Completed"
            : tool.state === "output-error"
              ? tool.error || "Error"
              : "In progress",
        status: toChainStepStatus(tool.state),
      })
    }
  }

  if (sources && sources.length > 0) {
    steps.push({
      id: `${itemId}-sources`,
      label: "Gathering sources",
      description: `Retrieved ${sources.length} source${sources.length === 1 ? "" : "s"}`,
      status: isStreaming ? "active" : "complete",
      sources,
    })
  }

  steps.push({
    id: `${itemId}-generation`,
    label: "Generating response",
    description: isStreaming ? "In progress" : "Completed",
    status: isStreaming ? "active" : hasAssistantText ? "complete" : "pending",
  })

  return steps
}
