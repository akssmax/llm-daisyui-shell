import { Plus } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { useDesignStore } from "../../store/design-store"
import { PageThumbnail } from "./page-thumbnail"
import { createBlankPage } from "../../lib/design-presets"

export function PageNavigator() {
  const { document, activePageId, setActivePage, applyPatches } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      activePageId: s.activePageId,
      setActivePage: s.setActivePage,
      applyPatches: s.applyPatches,
    })),
  )

  if (!document || document.pages.length <= 1) return null

  function addPage() {
    if (!document) return
    const firstPage = document.pages[0]
    const newPage = createBlankPage(firstPage.width, firstPage.height, document.theme.backgroundColor)
    applyPatches([{ op: "create_page", page: newPage }])
    setActivePage(newPage.id)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t bg-background px-2 py-1.5">
      {document.pages.map((page, idx) => (
        <PageThumbnail
          key={page.id}
          page={page}
          index={idx}
          isActive={page.id === activePageId}
          onClick={() => setActivePage(page.id)}
        />
      ))}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={addPage} title="Add page">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
