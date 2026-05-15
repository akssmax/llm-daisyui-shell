import {
  TAILWIND_BASE_SWATCHES,
  TAILWIND_COLOR_RAMPS,
  TAILWIND_SHADES,
  type TailwindShade,
} from "../tailwind-color-palette"
import type { ColorSystem, DesignTokensPreset } from "./types"

export const TAILWIND_ACCENT_HUES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const

export type TailwindAccentHue = (typeof TAILWIND_ACCENT_HUES)[number]
export type TailwindThemeMode = "light" | "dark"

export type TailwindThemeSelection = {
  accentHue: TailwindAccentHue
  mode: TailwindThemeMode
}

const ALLOWED_HEX = new Set<string>([
  ...TAILWIND_BASE_SWATCHES.map((s) => s.hex.toUpperCase()),
  ...TAILWIND_COLOR_RAMPS.flatMap((r) =>
    TAILWIND_SHADES.map((shade) => r.shades[shade as TailwindShade].toUpperCase()),
  ),
])

function rampHex(hue: string, shade: TailwindShade): string {
  const ramp = TAILWIND_COLOR_RAMPS.find((r) => r.name === hue) ?? TAILWIND_COLOR_RAMPS.find((r) => r.name === "slate")!
  return ramp.shades[shade]
}

export function isAllowedTailwindHex(hex: string): boolean {
  return ALLOWED_HEX.has(hex.trim().toUpperCase())
}

export function normalizeAccentHue(hue: string | undefined): TailwindAccentHue {
  const key = (hue ?? "").trim().toLowerCase()
  if ((TAILWIND_ACCENT_HUES as readonly string[]).includes(key)) {
    return key as TailwindAccentHue
  }
  return "indigo"
}

export function normalizeThemeMode(mode: string | undefined): TailwindThemeMode {
  return mode === "dark" ? "dark" : "light"
}

export function parseTailwindThemeSelection(obj: unknown): TailwindThemeSelection | null {
  if (!obj || typeof obj !== "object") return null
  const r = obj as Record<string, unknown>
  const accentHue = typeof r.accentHue === "string" ? r.accentHue : undefined
  const mode = typeof r.mode === "string" ? r.mode : undefined
  if (!accentHue && !mode) return null
  return {
    accentHue: normalizeAccentHue(accentHue),
    mode: normalizeThemeMode(mode),
  }
}

/** Token colors derived only from Tailwind CSS v3 ramps. */
export function buildTailwindTokenBundle(options: {
  accentHue: TailwindAccentHue
  mode: TailwindThemeMode
}): DesignTokensPreset {
  const { accentHue, mode } = options
  const neutral = "slate"

  const colors: ColorSystem =
    mode === "light"
      ? {
          background: rampHex(neutral, 50),
          surface: rampHex(neutral, 100),
          textPrimary: rampHex(neutral, 900),
          textSecondary: rampHex(neutral, 600),
          accent: rampHex(accentHue, 600),
          accentMuted: rampHex(accentHue, 300),
        }
      : {
          background: rampHex(neutral, 950),
          surface: rampHex(neutral, 900),
          textPrimary: rampHex(neutral, 50),
          textSecondary: rampHex(neutral, 400),
          accent: rampHex(accentHue, 400),
          accentMuted: rampHex(accentHue, 700),
        }

  return {
    id: `tailwind-${accentHue}-${mode}`,
    name: `Tailwind ${accentHue} (${mode})`,
    styleTags: ["tailwind", accentHue, mode],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    typography: {
      hero: 72,
      h1: 56,
      h2: 40,
      h3: 32,
      body: 20,
      caption: 16,
    },
    colors,
    radius: [0, 4, 8, 12, 16],
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.05)",
      md: "0 4px 12px rgba(0,0,0,0.08)",
      lg: "0 12px 32px rgba(0,0,0,0.12)",
    },
    rules: {
      lineHeight: { hero: 1.1, h1: 1.15, body: 1.5, caption: 1.4 },
      maxLineWidth: 720,
      contrastMin: 4.5,
    },
    headingFont: "Inter",
    bodyFont: "Inter",
  }
}

export function tailwindThemePromptList(): string {
  return TAILWIND_ACCENT_HUES.join(", ")
}
