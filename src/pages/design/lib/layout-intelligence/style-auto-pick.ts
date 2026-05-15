import type { IntentPlanPayload } from "../design-agent-schemas"
import { getAllStylePresets, getStylePresetById } from "./layout-catalog"
import type { StylePreset } from "./types"

/** Agent picks style preset from intent — no manual UI required. */
export function pickStylePresetForIntent(
  userMessage: string,
  intent: IntentPlanPayload,
): StylePreset | undefined {
  const blob = `${userMessage} ${intent.intent.tone} ${intent.intent.platform} ${intent.intent.designType}`.toLowerCase()
  const presets = getAllStylePresets()

  const rules: Array<{ match: RegExp; id: string }> = [
    { match: /\bbrutalist\b/, id: "brutalist-style" },
    { match: /\bluxury\b|\bpremium\b|\belegant\b/, id: "luxury-style" },
    { match: /\bswiss\b|\beditorial\b|\bmagazine\b/, id: "swiss-style" },
    { match: /\bplayful\b|\bvibrant\b/, id: "social-style" },
    { match: /\blinear\b(?!\s+gradient)|\bdeveloper\b/, id: "linear-style" },
    { match: /\benterprise\b|\bcorporate\b|\bb2b\b/, id: "enterprise-style" },
    { match: /\bstartup\b|\bsaas\b/, id: "startup-style" },
    { match: /\bminimal\b|\bclean\b/, id: "modern-saas-style" },
  ]

  for (const rule of rules) {
    if (rule.match.test(blob)) {
      const p = getStylePresetById(rule.id)
      if (p) return p
    }
  }

  if (intent.intent.density === "dense") return presets.find((p) => p.id === "enterprise-style")
  if (intent.intent.density === "minimal") return presets.find((p) => p.id === "luxury-style")
  return presets.find((p) => p.id === "modern-saas-style")
}
