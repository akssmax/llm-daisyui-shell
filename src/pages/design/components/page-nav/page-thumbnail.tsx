import { cn } from "@/lib/utils"
import type { DesignPage } from "../../types"
import { safePageElements } from "../../lib/safe-page-elements"

interface Props {
  page: DesignPage
  index: number
  isActive: boolean
  onClick: () => void
}

const THUMB_WIDTH = 80

export function PageThumbnail({ page, index, isActive, onClick }: Props) {
  const w = page.width > 0 ? page.width : 1080
  const h = page.height > 0 ? page.height : 1080
  const scale = THUMB_WIDTH / w
  const thumbHeight = Math.round(h * scale)
  const elements = safePageElements(page)

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded p-1 transition-colors",
        isActive ? "bg-accent" : "hover:bg-muted",
      )}
    >
      <div
        style={{ width: THUMB_WIDTH, height: thumbHeight, position: "relative", overflow: "hidden" }}
        className="rounded border bg-white shadow-sm"
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: w,
            height: h,
            backgroundColor: page.backgroundColor ?? "#ffffff",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {elements
            .filter((el) => el.kind === "shape")
            .map((el) => (
              <div
                key={el.id}
                style={{
                  position: "absolute",
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  backgroundColor: el.kind === "shape" ? el.fill : "transparent",
                  borderRadius: el.kind === "shape" ? (el.borderRadius ?? 0) : 0,
                  opacity: el.opacity,
                }}
              />
            ))}
        </div>
      </div>
      <span className="text-muted-foreground text-xs">{index + 1}</span>
    </button>
  )
}
