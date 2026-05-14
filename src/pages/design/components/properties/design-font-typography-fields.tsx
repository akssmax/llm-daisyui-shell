import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  canonicalPrimaryFamily,
  collectLoadedFontWeightCatalog,
  ensureGoogleFontLoaded,
} from "../../lib/design-fonts"
import { fontWeightOptionLabel, snapFontWeightToAllowed } from "../../lib/design-text-style"
import { useDesignStore } from "../../store/design-store"
import type { TextElement } from "../../types"

const DEFAULT_ROMAN_WEIGHTS: readonly number[] = [300, 400, 500, 600, 700]

type Props = {
  fontFamily: string
  fontWeight: string
  fontStyle: TextElement["fontStyle"]
  onPatch: (patch: Partial<Pick<TextElement, "fontWeight" | "fontStyle">>) => void
}

/**
 * Weight + italic controls driven by `document.fonts` for the active primary family
 * (after Google Fonts CSS with full static axis is loaded).
 */
export function DesignFontTypographyFields({ fontFamily, fontWeight, fontStyle, onPatch }: Props) {
  const fontEpoch = useDesignStore((s) => s.fontEpoch)
  const canonical = useMemo(() => canonicalPrimaryFamily(fontFamily), [fontFamily])
  const [catalog, setCatalog] = useState<{ roman: number[]; italic: number[] } | null>(null)
  const prevCanonicalRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await ensureGoogleFontLoaded(canonical)
      await document.fonts.ready.catch(() => {})
      if (cancelled) return
      setCatalog(collectLoadedFontWeightCatalog(canonical))
    })()
    return () => {
      cancelled = true
    }
  }, [canonical, fontEpoch])

  const hasItalic = (catalog?.italic.length ?? 0) > 0
  const roman = catalog?.roman ?? [...DEFAULT_ROMAN_WEIGHTS]
  const italicWeights = catalog?.italic ?? []

  const allowedForStyle = useMemo(
    () => (fontStyle === "italic" && italicWeights.length > 0 ? italicWeights : roman),
    [fontStyle, italicWeights, roman],
  )

  const selectWeight = snapFontWeightToAllowed(fontWeight, allowedForStyle)

  const onWeight = useCallback(
    (v: string) => {
      onPatch({ fontWeight: v })
    },
    [onPatch],
  )

  const onStyle = useCallback(
    (v: string) => {
      if (v !== "italic" && v !== "normal") return
      if (v === "italic" && italicWeights.length > 0) {
        const nextW = snapFontWeightToAllowed(fontWeight, italicWeights)
        onPatch({ fontStyle: "italic", fontWeight: nextW })
        return
      }
      onPatch({ fontStyle: v })
    },
    [fontWeight, italicWeights, onPatch],
  )

  useEffect(() => {
    if (!catalog) return
    if (!hasItalic && fontStyle === "italic") {
      onPatch({ fontStyle: "normal" })
    }
  }, [catalog, hasItalic, fontStyle, onPatch])

  useEffect(() => {
    if (!catalog) return
    if (prevCanonicalRef.current === canonical) return
    prevCanonicalRef.current = canonical
    const s = snapFontWeightToAllowed(fontWeight, allowedForStyle)
    const wTrim = String(fontWeight).trim().toLowerCase()
    const redundant =
      (wTrim === "normal" && s === "400") || (wTrim === "bold" && s === "700")
    if (s !== fontWeight && !redundant) {
      onPatch({ fontWeight: s })
    }
  }, [allowedForStyle, canonical, catalog, fontWeight, onPatch])

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Font weight</Label>
        <Select value={selectWeight} onValueChange={onWeight}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {allowedForStyle.map((w) => (
              <SelectItem key={w} value={String(w)} className="text-xs">
                {fontWeightOptionLabel(w)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <Label className="text-xs">Style</Label>
        <Select value={fontStyle} onValueChange={onStyle} disabled={!hasItalic}>
          <SelectTrigger className="h-7 max-w-[12rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal" className="text-xs">
              Regular
            </SelectItem>
            <SelectItem value="italic" className="text-xs">
              Italic
            </SelectItem>
          </SelectContent>
        </Select>
        {!hasItalic ? (
          <p className="text-[10px] leading-tight text-muted-foreground">Italic is not available for this font.</p>
        ) : null}
      </div>
    </>
  )
}
