import type { LayoutTree } from "../design-agent-schemas"
import type { DesignTokensPreset, LayoutPattern, StylePreset } from "./types"

const layoutModules = import.meta.glob("../../../../../data/layouts/*.json", {
  eager: true,
  import: "default",
}) as Record<string, LayoutPattern>

const tokenModules = import.meta.glob("../../../../../data/design-tokens/*.json", {
  eager: true,
  import: "default",
}) as Record<string, DesignTokensPreset>

const stylePresetModule = import.meta.glob("../../../../../data/style-presets/index.json", {
  eager: true,
  import: "default",
}) as Record<string, StylePreset[]>

let _layouts: LayoutPattern[] | null = null
let _tokens: DesignTokensPreset[] | null = null
let _styles: StylePreset[] | null = null

export function getAllLayouts(): LayoutPattern[] {
  if (!_layouts) {
    _layouts = Object.values(layoutModules).filter(Boolean)
  }
  return _layouts
}

export function getLayoutById(id: string): LayoutPattern | undefined {
  return getAllLayouts().find((l) => l.id === id)
}

export function getAllTokenPresets(): DesignTokensPreset[] {
  if (!_tokens) {
    _tokens = Object.values(tokenModules).filter(Boolean)
  }
  return _tokens
}

export function getTokenPresetById(id: string): DesignTokensPreset | undefined {
  return getAllTokenPresets().find((t) => t.id === id)
}

export function getAllStylePresets(): StylePreset[] {
  if (!_styles) {
    const raw = Object.values(stylePresetModule)[0]
    _styles = Array.isArray(raw) ? raw : []
  }
  return _styles
}

export function getStylePresetById(id: string): StylePreset | undefined {
  return getAllStylePresets().find((s) => s.id === id)
}

/** Convert catalog layout regions to agent LayoutTree shape (preserves metadata + constraints). */
export function layoutPatternToLayoutTree(pattern: LayoutPattern): LayoutTree {
  return {
    regions: pattern.regions.map((r) => ({
      id: r.id,
      role: r.role,
      relativeRect: { ...r.relativeRect },
      ...(r.alignment ? { alignment: r.alignment } : {}),
      ...(r.importance ? { importance: r.importance } : {}),
      ...(r.iconHint ? { iconHint: r.iconHint } : {}),
    })),
    ...(pattern.constraints ? { constraints: pattern.constraints } : {}),
  }
}

/** Map token preset to DesignTokenBundle for assembler. */
export function tokenPresetToBundle(preset: DesignTokensPreset): {
  tokens: {
    colors: Record<string, string>
    radius: number
    spacingScale: number[]
    fontScale: number[]
    headingFont: string
    bodyFont: string
  }
} {
  return {
    tokens: {
      colors: {
        background: preset.colors.background,
        surface: preset.colors.surface,
        textPrimary: preset.colors.textPrimary,
        textSecondary: preset.colors.textSecondary,
        accent: preset.colors.accent,
        ...(preset.colors.accentMuted ? { accentMuted: preset.colors.accentMuted } : {}),
      },
      radius: preset.radius[0] ?? 8,
      spacingScale: preset.spacing,
      fontScale: [
        preset.typography.caption,
        preset.typography.body,
        preset.typography.h3,
        preset.typography.h2,
        preset.typography.h1,
        preset.typography.hero,
      ],
      headingFont: preset.headingFont,
      bodyFont: preset.bodyFont,
    },
  }
}
