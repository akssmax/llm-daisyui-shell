import { describe, expect, it } from "vitest"
import { buildUnifiedTraceSteps } from "./chat-trace-steps"
import type { MockToolCall } from "./mock-chat-data"

const tool: MockToolCall = {
  name: "t1",
  description: "Compose canvas",
  state: "input-streaming",
  output: { summary: "" },
}

describe("buildUnifiedTraceSteps", () => {
  it("includes Generating response by default when streaming", () => {
    const steps = buildUnifiedTraceSteps({
      itemId: "a",
      isStreaming: true,
      hasAssistantText: false,
      tools: [tool],
    })
    expect(steps.some((s) => s.label === "Generating response")).toBe(true)
  })

  it("omits Generating response when includeGenerationStep is false", () => {
    const steps = buildUnifiedTraceSteps({
      itemId: "a",
      isStreaming: true,
      hasAssistantText: false,
      tools: [tool],
      includeGenerationStep: false,
    })
    expect(steps.some((s) => s.label === "Generating response")).toBe(false)
    expect(steps.some((s) => s.label === "Compose canvas")).toBe(true)
  })
})
