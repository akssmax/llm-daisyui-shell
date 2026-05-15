import { cn } from "@/lib/utils"
import { fontFamilyForHtmlCss } from "../../lib/design-fonts"
import { htmlTextareaFontWeight } from "../../lib/design-text-style"
import { safePageElements } from "../../lib/safe-page-elements"
import type { DesignElement, DesignPage } from "../../types"

interface Props {
  page: DesignPage
  index: number
  isActive: boolean
  onClick: () => void
}

const THUMB_WIDTH = 80

function sortedElements(page: DesignPage): DesignElement[] {
  return [...safePageElements(page)].sort((a, b) => a.zIndex - b.zIndex)
}

function ThumbnailElement({ el }: { el: DesignElement }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    opacity: el.opacity,
    pointerEvents: "none",
  }

  if (el.kind === "text") {
    return (
      <div
        style={{
          ...base,
          fontFamily: fontFamilyForHtmlCss(el.fontFamily),
          fontSize: el.fontSize,
          fontWeight: htmlTextareaFontWeight(el.fontWeight),
          fontStyle: el.fontStyle,
          color: el.color ?? "#000000",
          textAlign: el.textAlign,
          lineHeight: el.lineHeight,
          overflow: "hidden",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          ...(el.backgroundColor ? { backgroundColor: el.backgroundColor } : {}),
          ...(el.borderRadius ? { borderRadius: el.borderRadius } : {}),
        }}
      >
        {el.content}
      </div>
    )
  }

  if (el.kind === "shape") {
    if (el.shape === "ellipse") {
      return (
        <div
          style={{
            ...base,
            backgroundColor: el.fill,
            borderRadius: "50%",
            border: el.stroke ? `${el.strokeWidth ?? 1}px solid ${el.stroke}` : undefined,
          }}
        />
      )
    }
    if (el.shape === "line" || el.shape === "arrow") {
      return (
        <div
          style={{
            ...base,
            backgroundColor: el.stroke ?? el.fill,
            height: Math.max(el.strokeWidth ?? 2, 2),
            top: el.y + el.height / 2,
          }}
        />
      )
    }
    return (
      <div
        style={{
          ...base,
          backgroundColor: el.fill,
          borderRadius: el.borderRadius ?? 0,
          border: el.stroke ? `${el.strokeWidth ?? 1}px solid ${el.stroke}` : undefined,
        }}
      />
    )
  }

  if (el.kind === "image") {
    const src = el.src?.trim()
    if (!src || src.startsWith("[data URL omitted")) {
      return <div style={{ ...base, backgroundColor: "#E2E8F0" }} />
    }
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          ...base,
          objectFit: el.objectFit ?? "cover",
          borderRadius: el.borderRadius ?? 0,
        }}
      />
    )
  }

  if (el.kind === "icon") {
    return (
      <div
        style={{
          ...base,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: el.color ?? "#000000",
          fontSize: Math.min(el.width, el.height) * 0.55,
        }}
      >
        ◆
      </div>
    )
  }

  return null
}

export function PageThumbnail({ page, index, isActive, onClick }: Props) {
  const w = page.width > 0 ? page.width : 1080
  const h = page.height > 0 ? page.height : 1080
  const scale = THUMB_WIDTH / w
  const thumbHeight = Math.round(h * scale)
  const elements = sortedElements(page)

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
          {elements.map((el) => (
            <ThumbnailElement key={el.id} el={el} />
          ))}
        </div>
      </div>
      <span className="text-muted-foreground text-xs">{index + 1}</span>
    </button>
  )
}
