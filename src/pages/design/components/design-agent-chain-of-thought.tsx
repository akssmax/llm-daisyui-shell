import { useMemo } from "react"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { buildUnifiedTraceSteps } from "@/lib/chat-trace-steps"
import type { MockToolCall } from "@/lib/mock-chat-data"
import type { DesignAgentPhaseTrace } from "../lib/design-agent-orchestrator"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

function phasesToMockTools(phases: DesignAgentPhaseTrace[]): MockToolCall[] {
  return phases.map((t) => ({
    name: t.id,
    description: t.label,
    state:
      t.state === "complete"
        ? ("output-available" as const)
        : t.state === "error"
          ? ("output-error" as const)
          : ("input-streaming" as const),
    output: { summary: t.summary },
    error: t.state === "error" ? t.summary : undefined,
  }))
}

export function DesignAgentChainOfThought(props: {
  assistantId: string
  phases: DesignAgentPhaseTrace[]
  isStreaming: boolean
  chainOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Raw model stream (all phases concatenated). */
  streamTrace: string
}) {
  const { assistantId, phases, isStreaming, chainOpen, onOpenChange, streamTrace } = props

  const tools = useMemo(() => phasesToMockTools(phases), [phases])

  const traceSteps = useMemo(
    () =>
      buildUnifiedTraceSteps({
        itemId: assistantId,
        isStreaming,
        hasAssistantText: !isStreaming,
        tools,
        includeGenerationStep: false,
      }),
    [assistantId, isStreaming, tools],
  )

  if (traceSteps.length === 0) return null

  return (
    <div className="space-y-2">
      <ChainOfThought defaultOpen={isStreaming} open={chainOpen} onOpenChange={onOpenChange}>
        <ChainOfThoughtHeader>
          {isStreaming ? (
            <Shimmer as="span" className="text-sm text-muted-foreground" duration={2.2}>
              Design agent running…
            </Shimmer>
          ) : (
            "Design agent"
          )}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          {traceSteps.map((step) => (
            <ChainOfThoughtStep
              key={step.id}
              label={step.label}
              description={step.description}
              status={step.status}
            />
          ))}
        </ChainOfThoughtContent>
      </ChainOfThought>

      {streamTrace.trim().length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-3.5 transition-transform [[data-state=open]_&]:rotate-180" />
            Raw stream (debug)
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre
              className="mt-2 max-h-[min(40vh,360px)] overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-foreground"
              suppressHydrationWarning
            >
              {streamTrace}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {phases.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-3.5 transition-transform [[data-state=open]_&]:rotate-180" />
            Phase JSON (per step)
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {phases.map((p) => (
              <div key={`${p.id}-${p.state}`} className="rounded-md border border-border/80 bg-muted/30 p-2">
                <p className="text-xs font-medium text-foreground">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.summary}</p>
                {p.rawJson ? (
                  <pre
                    className={cn(
                      "mt-1 max-h-40 overflow-auto font-mono text-[10px] leading-snug text-foreground",
                    )}
                    suppressHydrationWarning
                  >
                    {p.rawJson}
                  </pre>
                ) : null}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
