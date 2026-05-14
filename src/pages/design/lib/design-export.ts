import type { DesignDocument, DesignElement, DesignPage } from "../types"

// ─── HTML Export ────────────────────────────────────────────────────────────

function elementToHtml(el: DesignElement): string {
  const base = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex};opacity:${el.opacity};${el.rotation ? `transform:rotate(${el.rotation}deg);` : ""}`

  if (el.kind === "text") {
    return `<div style="${base}font-family:${el.fontFamily};font-size:${el.fontSize}px;font-weight:${el.fontWeight};font-style:${el.fontStyle};color:${el.color};text-align:${el.textAlign};line-height:${el.lineHeight};background:${el.backgroundColor ?? "transparent"};border-radius:${el.borderRadius ?? 0}px;padding:4px 8px;box-sizing:border-box;word-break:break-word;white-space:pre-wrap;">${el.content.replace(/\n/g, "<br/>")}</div>`
  }

  if (el.kind === "image") {
    return `<div style="${base}border-radius:${el.borderRadius ?? 0}px;overflow:hidden;"><img src="${el.src}" style="width:100%;height:100%;object-fit:${el.objectFit};display:block;" /></div>`
  }

  if (el.kind === "shape") {
    if (el.shape === "ellipse") {
      return `<div style="${base}"><svg width="${el.width}" height="${el.height}"><ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.fill}" stroke="${el.stroke ?? "none"}" stroke-width="${el.strokeWidth ?? 0}"/></svg></div>`
    }
    if (el.shape === "triangle") {
      const pts = `${el.width / 2},0 ${el.width},${el.height} 0,${el.height}`
      return `<div style="${base}"><svg width="${el.width}" height="${el.height}"><polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke ?? "none"}" stroke-width="${el.strokeWidth ?? 0}"/></svg></div>`
    }
    if (el.shape === "line") {
      return `<div style="${base}"><svg width="${el.width}" height="${el.height}"><line x1="0" y1="0" x2="${el.width}" y2="${el.height}" stroke="${el.stroke ?? el.fill}" stroke-width="${Math.max(1, el.strokeWidth ?? 2)}" stroke-linecap="round"/></svg></div>`
    }
    if (el.shape === "arrow") {
      const swA = Math.max(1, el.strokeWidth ?? 2)
      const col = el.stroke ?? el.fill
      const mid = el.id.replace(/[^a-zA-Z0-9_-]/g, "_")
      return `<div style="${base}"><svg width="${el.width}" height="${el.height}" viewBox="0 0 ${el.width} ${el.height}"><defs><marker id="m-${mid}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${col}"/></marker></defs><line x1="0" y1="0" x2="${Math.max(0, el.width - 8)}" y2="${Math.max(0, el.height - 2)}" stroke="${col}" stroke-width="${swA}" marker-end="url(#m-${mid})"/></svg></div>`
    }
    if (el.shape === "polygon") {
      const sides = Math.min(12, Math.max(3, el.polygonSides ?? 6))
      const cx = el.width / 2
      const cy = el.height / 2
      const r = Math.min(el.width, el.height) / 2 - (el.strokeWidth ?? 0) / 2
      const pts: string[] = []
      for (let i = 0; i < sides; i++) {
        const a = (-Math.PI / 2 + (i * 2 * Math.PI) / sides)
        pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
      }
      return `<div style="${base}"><svg width="${el.width}" height="${el.height}"><polygon points="${pts.join(" ")}" fill="${el.fill}" stroke="${el.stroke ?? "none"}" stroke-width="${el.strokeWidth ?? 0}"/></svg></div>`
    }
    if (el.shape === "star") {
      const n = Math.min(12, Math.max(3, el.starPoints ?? 5))
      const cx = el.width / 2
      const cy = el.height / 2
      const outer = Math.min(el.width, el.height) / 2 - (el.strokeWidth ?? 0) / 2
      const inner = outer * 0.45
      const pts: string[] = []
      const step = Math.PI / n
      for (let i = 0; i < 2 * n; i++) {
        const rad = i % 2 === 0 ? outer : inner
        const a = -Math.PI / 2 + i * step
        pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`)
      }
      return `<div style="${base}"><svg width="${el.width}" height="${el.height}"><polygon points="${pts.join(" ")}" fill="${el.fill}" stroke="${el.stroke ?? "none"}" stroke-width="${el.strokeWidth ?? 0}"/></svg></div>`
    }
    return `<div style="${base}background:${el.fill};border:${el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : "none"};border-radius:${el.borderRadius ?? 0}px;box-sizing:border-box;"></div>`
  }

  // icon — just a placeholder box
  return `<div style="${base}display:flex;align-items:center;justify-content:center;color:${el.color};font-size:${Math.min(el.width, el.height)}px;">◆</div>`
}

function pageToHtml(page: DesignPage): string {
  const sorted = [...(page.elements ?? [])].sort((a, b) => a.zIndex - b.zIndex)
  return `<div style="position:relative;width:${page.width}px;height:${page.height}px;background:${page.backgroundColor};overflow:hidden;page-break-after:always;margin:0 auto;">${sorted.map(elementToHtml).join("")}</div>`
}

export function htmlExport(doc: DesignDocument): void {
  const body = doc.pages.map(pageToHtml).join("\n")
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${doc.title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f4f4f5; display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 32px; }
  @media print { body { background: white; gap: 0; padding: 0; } }
</style>
</head>
<body>
${body}
</body>
</html>`

  const blob = new Blob([html], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${doc.title.replace(/\s+/g, "-")}.html`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Pixel ratio for raster export when the artboard is scaled by fit × user zoom.
 * Keeps bitmap sharpness when the stage is zoomed out on screen (Konva / html2canvas).
 */
export function computeRasterExportPixelRatio(opts: {
  devicePixelRatio: number
  fitScale: number
  userZoom: number
}): number {
  const denom = Math.max(0.05, opts.fitScale * opts.userZoom)
  return Math.min(4, Math.max(1, opts.devicePixelRatio / denom))
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

/** Konva (react-konva) renders into `.konvajs-content`; rasterizing that subtree is more reliable than the outer measure div alone. */
function resolveHtml2CanvasTarget(root: HTMLElement): HTMLElement {
  const inner = root.querySelector(".konvajs-content") as HTMLElement | null
  return inner ?? root
}

function waitNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

export async function pdfExport(
  doc: DesignDocument,
  pageElement: HTMLElement,
  rasterOpts?: { fitScale: number; userZoom: number; activePageId?: string | null },
): Promise<void> {
  const jsPDFModule = await import("jspdf")
  const JsPDF = (jsPDFModule as { default?: typeof import("jspdf").default; jsPDF?: typeof import("jspdf").default })
    .default ?? (jsPDFModule as { jsPDF?: typeof import("jspdf").default }).jsPDF
  if (!JsPDF) {
    throw new Error("Could not load jsPDF (missing default export).")
  }

  const { default: html2canvas } = await import("html2canvas")

  const exportPage =
    (rasterOpts?.activePageId ? doc.pages.find((p) => p.id === rasterOpts.activePageId) : undefined) ??
    doc.pages[0]
  if (!exportPage) return

  await waitNextPaint()
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready.catch(() => {})
  }

  const target = resolveHtml2CanvasTarget(pageElement)

  const dpr =
    typeof globalThis !== "undefined" && "devicePixelRatio" in globalThis
      ? Number((globalThis as unknown as { devicePixelRatio?: number }).devicePixelRatio) || 1
      : 1
  const scale = computeRasterExportPixelRatio({
    devicePixelRatio: dpr,
    fitScale: rasterOpts?.fitScale ?? 1,
    userZoom: rasterOpts?.userZoom ?? 1,
  })

  const pdf = new JsPDF({
    orientation: exportPage.width > exportPage.height ? "landscape" : "portrait",
    unit: "px",
    format: [exportPage.width, exportPage.height],
    compress: true,
  })

  const canvas = await html2canvas(target, {
    scale,
    useCORS: true,
    allowTaint: false,
    foreignObjectRendering: false,
    backgroundColor: "#ffffff",
    logging: false,
  })

  let imgData: string
  let imgFormat: "JPEG" | "PNG" = "JPEG"
  try {
    imgData = canvas.toDataURL("image/jpeg", 0.92)
  } catch {
    try {
      imgData = canvas.toDataURL("image/png")
      imgFormat = "PNG"
    } catch {
      throw new Error(
        "Could not read the canvas as an image. If the design uses photos from the web, try replacing them with uploaded images (cross-origin images block export).",
      )
    }
  }

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  pdf.addImage(imgData, imgFormat, 0, 0, pageW, pageH, undefined, "FAST")

  if (doc.pages.length > 1) {
    console.info(
      `Note: PDF export captured the active canvas (1 of ${doc.pages.length} pages). Switch pages and export again for each slide.`,
    )
  }

  pdf.save(`${doc.title.replace(/\s+/g, "-")}.pdf`)
}
