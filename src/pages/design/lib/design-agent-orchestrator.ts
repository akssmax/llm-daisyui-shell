import type { AgentPhaseSsePayload } from "@/lib/llm-service"
import type { MistralModel } from "@/lib/llm-types"
import type { FileUIPart } from "ai"
import type { DesignAiResponse } from "../types"
import { runDesignAgentTurnV2 } from "./design-agent-orchestrator-v2"
import type { DesignAgentOperation } from "./design-agent-router"

export type { DesignAgentOperation } from "./design-agent-router"

export type DesignAgentPhaseId =
  | "route_operation"
  | "intent_plan"
  | "layout_retrieval"
  | "layout_select"
  | "layout_tree"
  | "design_system"
  | "content_structure"
  | "content_map"
  | "canvas_select"
  | "region_bind"
  | "assemble"
  | "validate"
  | "refine_engine"
  | "refine_content"
  | "critic"
  | "auto_fix"
  | "finalize"
  | "compose"
  | "compose_document"
  | "extract_content"
  | "repair"

export type DesignAgentPhaseTrace = {
  id: DesignAgentPhaseId
  label: string
  summary: string
  state: "running" | "complete" | "error"
  rawJson?: string
}

export type RunDesignAgentTurnOptions = {
  userMessage: string
  attachments?: FileUIPart[]
  signal?: AbortSignal
  model?: MistralModel
  forcedOperation?: DesignAgentOperation
  onToken?: (token: string) => void
  onAgentPhase?: (payload: AgentPhaseSsePayload) => void
  onPhaseComplete?: (trace: DesignAgentPhaseTrace) => void
  onPhaseBuffer?: (phaseId: DesignAgentPhaseId, buffer: string) => void
}

export async function runDesignAgentTurn(opts: RunDesignAgentTurnOptions): Promise<{
  response: DesignAiResponse
  phases: DesignAgentPhaseTrace[]
  debugBundle: Record<string, unknown>
}> {
  return runDesignAgentTurnV2(opts)
}
