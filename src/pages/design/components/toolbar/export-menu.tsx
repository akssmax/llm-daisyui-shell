import { Download, FileCode, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDesignStore } from "../../store/design-store"
import { htmlExport, pdfExport } from "../../lib/design-export"
import type { DesignCanvasHandle } from "../canvas/design-canvas"

interface Props {
  canvasRef: React.RefObject<DesignCanvasHandle | null>
}

export function ExportMenu({ canvasRef }: Props) {
  const document = useDesignStore((s) => s.document)
  const canvasFitScale = useDesignStore((s) => s.canvasFitScale)
  const userZoom = useDesignStore((s) => s.viewport.userZoom)

  if (!document) return null

  async function handleHtml() {
    if (!document) return
    htmlExport(document)
  }

  async function handlePdf() {
    if (!document || !canvasRef.current) return
    const el = canvasRef.current.getPageElement()
    if (!el) return
    await pdfExport(document, el, { fitScale: canvasFitScale, userZoom })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleHtml} className="gap-2">
          <FileCode className="h-4 w-4" />
          Export as HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} className="gap-2">
          <FileText className="h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
