import type { LayoutPattern } from "./types"
import type { RegionContent } from "../design-compose-assembler"
import type { RegionContentPayload } from "../design-agent-schemas"
import { extractSilhouetteFromText, normalizeSilhouetteName } from "../agent-silhouette-registry"
import { extractIconNameFromText } from "../lucide-icon-registry"

const SEMANTIC_ALIASES: Record<string, string[]> = {
  headline: ["headline", "title", "heading", "hero_title"],
  subheading: ["subheading", "subtitle", "subhead", "eyebrow"],
  body: ["body", "description", "copy", "paragraph"],
  cta: ["cta", "footer", "button", "call_to_action"],
  footer: ["footer", "cta", "tagline"],
  visual: ["visual", "image", "hero_image", "illustration"],
  icon: ["icon", "visual", "accent_icon", "logo"],
  quote: ["quote", "testimonial"],
  stats: ["stats", "stat", "metrics", "kpi"],
}

function findRegionId(layout: LayoutPattern, semanticKey: string): string | null {
  const aliases = SEMANTIC_ALIASES[semanticKey] ?? [semanticKey]
  for (const region of layout.regions) {
    const id = region.id.toLowerCase()
    const role = region.role.toLowerCase()
    if (aliases.some((a) => id === a || role === a || id.includes(a) || role.includes(a))) {
      return region.id
    }
  }
  return null
}

function inferSemanticKey(regionId: string): string {
  const id = regionId.toLowerCase()
  for (const [key, aliases] of Object.entries(SEMANTIC_ALIASES)) {
    if (aliases.some((a) => id === a || id.includes(a))) return key
  }
  return id
}

function toRegionContent(item: RegionContentPayload): RegionContent {
  const role = inferSemanticKey(item.regionId)
  const text = item.content?.trim() ?? ""
  const silhouetteFromText = extractSilhouetteFromText(text)
  const silhouetteName =
    item.kind === "silhouette"
      ? normalizeSilhouetteName(item.content) ?? silhouetteFromText
      : silhouetteFromText
  if (silhouetteName) {
    return {
      regionId: item.regionId,
      content: silhouetteName,
      kind: "silhouette",
      shapeName: silhouetteName,
      ...(item.color ? { color: item.color } : {}),
    }
  }

  const iconFromText = extractIconNameFromText(text)
  const iconName = item.iconName ?? iconFromText ?? undefined

  if (item.kind === "icon" || iconName || role === "icon") {
    if (iconName) {
      return {
        regionId: item.regionId,
        content: iconName,
        kind: "icon",
        iconName,
        ...(item.color ? { color: item.color } : {}),
      }
    }
  }

  return {
    regionId: item.regionId,
    content: text,
    ...(item.kind ? { kind: item.kind } : {}),
    ...(item.fontSize !== undefined ? { fontSize: item.fontSize } : {}),
    ...(item.fontWeight ? { fontWeight: item.fontWeight } : {}),
    ...(item.textAlign ? { textAlign: item.textAlign } : {}),
    ...(item.fill ? { fill: item.fill } : {}),
    ...(item.color ? { color: item.color } : {}),
  }
}

/** Remap draft region contents onto the chosen layout's region ids. */
export function bindRegionsToLayout(
  layout: LayoutPattern,
  draftContents: RegionContentPayload[],
): RegionContent[] {
  const bySemantic = new Map<string, RegionContentPayload[]>()

  for (const item of draftContents) {
    const key = inferSemanticKey(item.regionId)
    const list = bySemantic.get(key) ?? []
    list.push(item)
    bySemantic.set(key, list)
  }

  const used = new Set<string>()
  const out: RegionContent[] = []

  for (const region of layout.regions) {
    const role = region.role.toLowerCase()
    const id = region.id.toLowerCase()
    let source: RegionContentPayload | undefined

    const direct = draftContents.find(
      (d) => d.regionId === region.id || d.regionId.toLowerCase() === id,
    )
    if (direct) {
      source = direct
    } else {
      const semanticKey =
        Object.keys(SEMANTIC_ALIASES).find((k) => {
          const aliases = SEMANTIC_ALIASES[k]!
          return aliases.some((a) => role === a || id === a || role.includes(a) || id.includes(a))
        }) ?? role
      const queue = bySemantic.get(semanticKey)
      source = queue?.shift()
    }

    if (!source?.content?.trim() && !source?.iconName && source?.kind !== "icon") continue

    const bound = toRegionContent({ ...source, regionId: region.id })
    const silhouetteName =
      bound.kind === "silhouette"
        ? bound.shapeName ?? extractSilhouetteFromText(bound.content)
        : extractSilhouetteFromText(bound.content)
    if (silhouetteName) {
      out.push({
        regionId: region.id,
        content: silhouetteName,
        kind: "silhouette",
        shapeName: silhouetteName,
        color: bound.color,
      })
      used.add(region.id)
      continue
    }
    if (bound.kind === "icon" || region.role === "icon" || id === "visual" || role === "image") {
      const iconName = bound.iconName ?? extractIconNameFromText(bound.content)
      if (iconName) {
        out.push({
          regionId: region.id,
          content: iconName,
          kind: "icon",
          iconName,
          color: bound.color,
        })
        used.add(region.id)
        continue
      }
    }

    out.push({ ...bound, regionId: region.id })
    used.add(region.id)
  }

  for (const item of draftContents) {
    if (used.has(item.regionId)) continue
    const targetId = findRegionId(layout, inferSemanticKey(item.regionId))
    if (targetId && !out.some((o) => o.regionId === targetId)) {
      out.push(toRegionContent({ ...item, regionId: targetId }))
    }
  }

  return out
}

export function bindSlidesToLayout(
  layout: LayoutPattern,
  slides: RegionContentPayload[][],
): RegionContent[][] {
  return slides.map((slide) => bindRegionsToLayout(layout, slide))
}
