import type { DesignElement } from "../../../types"
import { contrastRatio } from "../composition-rules"
import { getTokenPresetById } from "../layout-catalog"
import type { ColorSystem, DesignTokensPreset } from "../types"
import { isAllowedTailwindHex } from "../tailwind-theme-builder"

export type ColorPassOptions = {
  tokenPresetId?: string
  tokenPreset?: DesignTokensPreset
  enforceTailwindOnly?: boolean
}

function resolveColors(opts?: ColorPassOptions): ColorSystem {
  const preset = opts?.tokenPreset ?? (opts?.tokenPresetId ? getTokenPresetById(opts.tokenPresetId) : undefined)
  return (
    preset?.colors ?? {
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#4F46E5",
      background: "#FFFFFF",
      surface: "#F1F5F9",
    }
  )
}

function snapColor(hex: string, colors: ColorSystem, enforceTailwind: boolean): string {
  if (!enforceTailwind || isAllowedTailwindHex(hex)) return hex
  return colors.textPrimary
}

export function runColorPass(
  elements: DesignElement[],
  pageBackground: string,
  opts?: ColorPassOptions | string,
): DesignElement[] {
  const passOpts: ColorPassOptions =
    typeof opts === "string" ? { tokenPresetId: opts } : (opts ?? {})
  const colors = resolveColors(passOpts)
  const enforce = passOpts.enforceTailwindOnly ?? false
  const textPrimary = colors.textPrimary
  const textSecondary = colors.textSecondary
  const accent = colors.accent
  const minContrast = passOpts.tokenPreset?.rules.contrastMin ?? 4.5

  return elements.map((el) => {
    if (el.kind === "icon") {
      let color = snapColor(el.color || accent, colors, enforce)
      if (contrastRatio(color, pageBackground) < 3) {
        color = contrastRatio(accent, pageBackground) >= 3 ? accent : textPrimary
      }
      return { ...el, color: snapColor(color, colors, enforce) }
    }

    if (el.kind !== "text") return el

    let color = snapColor(el.color, colors, enforce)
    if (contrastRatio(color, pageBackground) < minContrast) {
      color = contrastRatio(textPrimary, pageBackground) >= minContrast ? textPrimary : "#FFFFFF"
    }
    const role = el.fontSize >= 40
    const isCta = el.content.length < 30 && el.fontWeight === "700"
    if (isCta) color = accent
    else if (!role && el.fontSize < 24) color = textSecondary

    return { ...el, color: snapColor(color, colors, enforce) }
  })
}
