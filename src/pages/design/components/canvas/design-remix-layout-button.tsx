import { Shuffle } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { useDesignStore } from "../../store/design-store"
import { safePageElements } from "../../lib/safe-page-elements"

/** Magic remix: same copy, new layout — triggers agent via chat panel. */
export function DesignRemixLayoutButton() {
  const { document, designAgentPipelineEnabled, isAiLoading, requestRemixLayout } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      designAgentPipelineEnabled: s.designAgentPipelineEnabled,
      isAiLoading: s.isAiLoading,
      requestRemixLayout: s.requestRemixLayout,
    })),
  )

  const hasElements =
    document?.pages.some((p) => safePageElements(p).length > 0) ?? false

  if (!document || !hasElements || !designAgentPipelineEnabled) return null

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="pointer-events-auto h-8 gap-1.5 text-xs shadow-md"
      disabled={isAiLoading}
      onClick={() => requestRemixLayout()}
      title="Remix layout — keep copy, new arrangement"
    >
      <Shuffle className="h-3.5 w-3.5" />
      Remix layout
    </Button>
  )
}
