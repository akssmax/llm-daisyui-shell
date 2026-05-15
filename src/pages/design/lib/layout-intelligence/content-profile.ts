import type { RegionContent } from "../design-compose-assembler"
import type { RegionContentPayload } from "../design-agent-schemas"
import { extractIconNameFromText } from "../lucide-icon-registry"

export type ContentProfile = {
  slideCount: number
  maxHeadlineChars: number
  maxBodyChars: number
  maxFooterChars: number
  maxSubheadingChars: number
  statCount: number
  hasQuote: boolean
  hasCta: boolean
  hasFooter: boolean
  needsIcon: boolean
  iconHints: string[]
  density: "low" | "medium" | "high"
}

type ContentItem = RegionContent | RegionContentPayload

function roleOf(item: ContentItem): string {
  return item.regionId.toLowerCase()
}

function textOf(item: ContentItem): string {
  return item.content?.trim() ?? ""
}

function maxLen(items: ContentItem[], match: (role: string) => boolean): number {
  let max = 0
  for (const item of items) {
    if (!match(roleOf(item))) continue
    max = Math.max(max, textOf(item).length)
  }
  return max
}

function collectFromSlide(items: ContentItem[]): Partial<ContentProfile> {
  let needsIcon = false
  const iconHints: string[] = []
  let statCount = 0
  let hasQuote = false
  let hasCta = false
  let hasFooter = false

  for (const item of items) {
    const role = roleOf(item)
    const text = textOf(item)
    if (!text && item.kind !== "icon" && !item.iconName) continue

    if (role.includes("stat")) statCount++
    if (role.includes("quote")) hasQuote = true
    if (role === "cta" || role.includes("cta")) hasCta = true
    if (role.includes("footer")) hasFooter = true

    const iconFromText = extractIconNameFromText(text)
    const iconName = item.iconName ?? iconFromText
    if (item.kind === "icon" || role.includes("visual") || role === "icon" || iconName) {
      needsIcon = true
      if (iconName) iconHints.push(iconName)
    }
  }

  return {
    maxHeadlineChars: maxLen(items, (r) => r.includes("head") || r.includes("title")),
    maxBodyChars: maxLen(items, (r) => r.includes("body")),
    maxFooterChars: maxLen(items, (r) => r.includes("footer") || r === "cta"),
    maxSubheadingChars: maxLen(items, (r) => r.includes("sub")),
    statCount,
    hasQuote,
    hasCta,
    hasFooter,
    needsIcon,
    iconHints,
  }
}

function mergeProfiles(a: ContentProfile, b: Partial<ContentProfile>): ContentProfile {
  return {
    slideCount: a.slideCount,
    maxHeadlineChars: Math.max(a.maxHeadlineChars, b.maxHeadlineChars ?? 0),
    maxBodyChars: Math.max(a.maxBodyChars, b.maxBodyChars ?? 0),
    maxFooterChars: Math.max(a.maxFooterChars, b.maxFooterChars ?? 0),
    maxSubheadingChars: Math.max(a.maxSubheadingChars, b.maxSubheadingChars ?? 0),
    statCount: Math.max(a.statCount, b.statCount ?? 0),
    hasQuote: a.hasQuote || Boolean(b.hasQuote),
    hasCta: a.hasCta || Boolean(b.hasCta),
    hasFooter: a.hasFooter || Boolean(b.hasFooter),
    needsIcon: a.needsIcon || Boolean(b.needsIcon),
    iconHints: [...new Set([...a.iconHints, ...(b.iconHints ?? [])])],
    density: a.density,
  }
}

export function buildContentProfile(
  slides: ContentItem[][],
  slideCount: number,
): ContentProfile {
  let profile: ContentProfile = {
    slideCount: Math.max(1, slideCount),
    maxHeadlineChars: 0,
    maxBodyChars: 0,
    maxFooterChars: 0,
    maxSubheadingChars: 0,
    statCount: 0,
    hasQuote: false,
    hasCta: false,
    hasFooter: false,
    needsIcon: false,
    iconHints: [],
    density: "medium",
  }

  const totalChars =
    slides.flat().reduce((sum, item) => sum + textOf(item).length, 0) / Math.max(1, slides.length)
  if (totalChars > 400) profile = { ...profile, density: "high" }
  else if (totalChars < 180) profile = { ...profile, density: "low" }

  for (const slide of slides) {
    profile = mergeProfiles(profile, collectFromSlide(slide))
  }

  return profile
}

export function contentProfileBucket(profile: ContentProfile): string {
  const h = profile.maxHeadlineChars > 60 ? "long-h" : profile.maxHeadlineChars > 36 ? "med-h" : "short-h"
  const b = profile.maxBodyChars > 140 ? "long-b" : profile.maxBodyChars > 80 ? "med-b" : "short-b"
  const slides = profile.slideCount > 1 ? `slides-${profile.slideCount}` : "single"
  const icon = profile.needsIcon ? "icon" : "no-icon"
  return `${slides}:${h}:${b}:${icon}`
}
