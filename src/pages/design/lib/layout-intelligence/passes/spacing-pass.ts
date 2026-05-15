import type { DesignElement } from "../../../types"

const GRID = 8
const MIN_MARGIN = 64

function snap8(n: number): number {
  return Math.round(n / GRID) * GRID
}

export function runSpacingPass(
  elements: DesignElement[],
  pageWidth: number,
  pageHeight: number,
): DesignElement[] {
  return elements.map((el) => {
    let x = snap8(el.x)
    let y = snap8(el.y)
    let w = Math.max(GRID, snap8(el.width))
    let h = Math.max(GRID, snap8(el.height))

    x = Math.max(MIN_MARGIN, Math.min(x, pageWidth - MIN_MARGIN - w))
    y = Math.max(MIN_MARGIN, Math.min(y, pageHeight - MIN_MARGIN - h))
    w = Math.min(w, pageWidth - MIN_MARGIN - x)
    h = Math.min(h, pageHeight - MIN_MARGIN - y)

    return { ...el, x, y, width: w, height: h }
  })
}
