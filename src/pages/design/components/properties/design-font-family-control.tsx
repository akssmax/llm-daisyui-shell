import { useCallback, useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CURATED_GOOGLE_FONT_FAMILIES,
  CUSTOM_FONT_SENTINEL,
  canonicalPrimaryFamily,
  curatedFontSelectValue,
  ensureGoogleFontLoaded,
  primaryFamilyFromStack,
  stackFromCuratedGoogleFamily,
} from "../../lib/design-fonts"

type Props = {
  fontFamily: string
  onCommitStack: (stack: string) => void
  /** Tighter layout for the header quick strip */
  compact?: boolean
}

export function DesignFontFamilyControl({ fontFamily, onCommitStack, compact }: Props) {
  const curatedKey = curatedFontSelectValue(fontFamily)
  const [customOpen, setCustomOpen] = useState(curatedKey === CUSTOM_FONT_SENTINEL)
  const [customDraft, setCustomDraft] = useState(primaryFamilyFromStack(fontFamily))

  useEffect(() => {
    setCustomDraft(primaryFamilyFromStack(fontFamily))
    if (curatedKey === CUSTOM_FONT_SENTINEL) setCustomOpen(true)
  }, [fontFamily, curatedKey])

  const applyStack = useCallback(
    (stack: string) => {
      onCommitStack(stack)
      void ensureGoogleFontLoaded(canonicalPrimaryFamily(stack))
    },
    [onCommitStack],
  )

  const selectModelValue =
    curatedKey === CUSTOM_FONT_SENTINEL || customOpen ? CUSTOM_FONT_SENTINEL : curatedKey

  const onSelectFamily = useCallback(
    (value: string) => {
      if (value === CUSTOM_FONT_SENTINEL) {
        setCustomOpen(true)
        setCustomDraft(primaryFamilyFromStack(fontFamily))
        return
      }
      setCustomOpen(false)
      setCustomDraft(value)
      applyStack(stackFromCuratedGoogleFamily(value))
    },
    [applyStack, fontFamily],
  )

  const commitCustom = useCallback(() => {
    const t = customDraft.trim()
    if (!t) return
    const stack = t.includes(",") ? t : `${t}, system-ui, sans-serif`
    applyStack(stack)
    if (curatedFontSelectValue(stack) !== CUSTOM_FONT_SENTINEL) {
      setCustomOpen(false)
    }
  }, [applyStack, customDraft])

  const showCustomInput = customOpen || curatedKey === CUSTOM_FONT_SENTINEL

  return (
    <div className={compact ? "flex flex-wrap items-center gap-1.5" : "flex flex-col gap-1"}>
      <Label className={compact ? "shrink-0 text-xs text-muted-foreground" : "text-xs"}>Font</Label>
      <div className={compact ? "flex min-w-0 flex-1 flex-wrap items-center gap-1" : "flex flex-col gap-2"}>
        <Select value={selectModelValue} onValueChange={onSelectFamily}>
          <SelectTrigger className={compact ? "h-7 min-w-[7.5rem] max-w-[11rem] text-xs" : "h-7 text-xs"}>
            <SelectValue placeholder="Family" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {CURATED_GOOGLE_FONT_FAMILIES.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">
                {name}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_FONT_SENTINEL} className="text-xs">
              Custom…
            </SelectItem>
          </SelectContent>
        </Select>
        {showCustomInput ? (
          <div className={compact ? "flex min-w-[8rem] flex-1 items-center gap-1" : "flex flex-col gap-1"}>
            <Input
              className={compact ? "h-7 flex-1 text-xs" : "h-7 text-xs"}
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onBlur={commitCustom}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  commitCustom()
                }
              }}
              placeholder='e.g. Roboto or "Playfair Display"'
              spellCheck={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
