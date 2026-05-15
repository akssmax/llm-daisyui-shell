import type { DesignTokenBundle, IntentPlanPayload, LayoutTree } from "../design-agent-schemas"
import type { RegionContent } from "../design-compose-assembler"
import { regionToPixelBox } from "../design-compose-assembler"
import type { LayoutConstraints, LayoutPattern, RegionConstraint } from "./types"
import { resolveTypography, enforceHierarchyScale } from "./typography-engine"
import { fitTextToRegion } from "./text-fit-engine"
import { getTokenPresetById, layoutPatternToLayoutTree } from "./layout-catalog"
import type { DesignTokensPreset } from "./types"
import { extractSilhouetteFromText, normalizeSilhouetteName } from "../agent-silhouette-registry"
import { parsePatternId } from "../fill-pattern-catalog"
import {
  DEFAULT_LUCIDE_STROKE_WIDTH,
  extractIconNameFromText,
  normalizeIconName,
} from "../lucide-icon-registry"

function extractPatternFromText(content: string): string | null {
  const m = content.match(/pattern\s*[:=]\s*([a-z0-9-]+)/i)
  return m?.[1] ? parsePatternId(m[1]) : null
}

export type TextElementSpec = {
  kind: "text"
  regionId: string
  content: string
  box: { x: number; y: number; width: number; height: number }
  fontSize: number
  lineHeight: number
  fontWeight: string
  textAlign: "left" | "center" | "right"
  fontFamily: string
  color: string
}

export type IconElementSpec = {
  kind: "icon"
  regionId: string
  iconName: string
  box: { x: number; y: number; width: number; height: number }
  color: string
  strokeWidth?: number
}

export type ShapeElementSpec = {
  kind: "shape"
  regionId: string
  box: { x: number; y: number; width: number; height: number }
  fill: string
  patternFill?: { patternId: string; patternColor: string }
}

export type SilhouetteElementSpec = {
  kind: "silhouette"
  regionId: string
  shapeName: string
  box: { x: number; y: number; width: number; height: number }
  color: string
}

export type ElementSpec = TextElementSpec | IconElementSpec | ShapeElementSpec | SilhouetteElementSpec

export type CompositionPlan = {
  regions: ElementSpec[]
  visualHierarchy: string[]
  spacingModel: { sectionGap: number; ctaFooterGap: number }
  pagePattern?: { patternId: string; color: string }
}

function snap8(n: number): number {
  return Math.round(n / 8) * 8
}

function applyEdgeDistance(
  box: { x: number; y: number; width: number; height: number },
  constraint: RegionConstraint | undefined,
  pageWidth: number,
  pageHeight: number,
  safeMargin: number,
): typeof box {
  const minEdge = constraint?.minDistanceFromEdge ?? 0
  if (minEdge <= 0) return box
  let { x, y, width, height } = box
  const bottom = pageHeight - safeMargin - minEdge
  if (y + height > bottom) {
    height = snap8(Math.max(8, bottom - y))
  }
  const right = pageWidth - safeMargin - minEdge
  if (x + width > right) {
    width = snap8(Math.max(8, right - x))
  }
  return { x, y, width, height }
}

function nudgeAwayFrom(
  box: { x: number; y: number; width: number; height: number },
  other: { x: number; y: number; width: number; height: number },
): typeof box {
  const overlapY = box.y < other.y + other.height && other.y < box.y + box.height
  const overlapX = box.x < other.x + other.width && other.x < box.x + box.width
  if (!overlapX || !overlapY) return box
  if (box.y >= other.y) {
    return { ...box, y: snap8(other.y + other.height + 8) }
  }
  return box
}

export type PlanCompositionInput = {
  layout: LayoutTree
  contents: RegionContent[]
  intentPlan: IntentPlanPayload
  tokens: DesignTokenBundle
  pageWidth: number
  pageHeight: number
  tokenPreset?: DesignTokensPreset
  constraints?: LayoutConstraints
  pagePattern?: { patternId: string; color: string }
}

export function planComposition(input: PlanCompositionInput): CompositionPlan {
  const { layout, contents, intentPlan, tokens, pageWidth, pageHeight, tokenPreset } = input
  const constraints = input.constraints ?? layout.constraints
  const margin = intentPlan.plan.grid.safeMargin ?? 64
  const typography = tokenPreset?.typography ?? {
    hero: 72,
    h1: 56,
    h2: 40,
    h3: 32,
    body: 20,
    caption: 16,
  }
  const contentById = new Map(contents.map((c) => [c.regionId, c]))
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>()

  for (const region of layout.regions) {
    let box = regionToPixelBox(region, pageWidth, pageHeight, margin)
    const rc = constraints?.regions[region.id]
    box = applyEdgeDistance(box, rc, pageWidth, pageHeight, margin)
    boxes.set(region.id, box)
  }

  for (const region of layout.regions) {
    const avoid = constraints?.regions[region.id]?.avoidOverlapWith ?? []
    let box = boxes.get(region.id)!
    for (const otherId of avoid) {
      const other = boxes.get(otherId)
      if (other) box = nudgeAwayFrom(box, other)
    }
    boxes.set(region.id, box)
  }

  const hierarchy = intentPlan.plan.visualHierarchy
  const specs: ElementSpec[] = []
  const textSpecsForHierarchy: Array<{ fontSize: number; isHeading: boolean }> = []

  for (const region of layout.regions) {
    const box = boxes.get(region.id)!
    const rc = contentById.get(region.id)
    const role = region.role.toLowerCase()
    const regionId = region.id.toLowerCase()
    const isVisualOrIcon =
      role === "icon" ||
      role === "image" ||
      regionId === "visual" ||
      regionId.includes("icon") ||
      rc?.kind === "icon"

    if (isVisualOrIcon) {
      const silhouetteName =
        extractSilhouetteFromText(rc?.content ?? "") ??
        (rc?.kind === "silhouette" ? normalizeSilhouetteName(rc.content) : null)
      if (silhouetteName) {
        const size = snap8(Math.min(box.width, box.height, 200, Math.max(80, Math.min(box.width, box.height) * 0.6)))
        specs.push({
          kind: "silhouette",
          regionId: region.id,
          shapeName: silhouetteName,
          box: {
            x: box.x + (box.width - size) / 2,
            y: box.y + (box.height - size) / 2,
            width: size,
            height: size,
          },
          color: rc?.color ?? tokens.tokens.colors.accent ?? "#6366F1",
        })
        continue
      }
      const rawIcon =
        rc?.iconName ?? extractIconNameFromText(rc?.content ?? "") ?? region.iconHint ?? ""
      const iconName = normalizeIconName(rawIcon)
      if (iconName) {
        const iconSize = snap8(Math.min(box.width, box.height, 96, Math.max(48, box.width * 0.35)))
      specs.push({
        kind: "icon",
        regionId: region.id,
        iconName,
        box: {
          x: box.x + (box.width - iconSize) / 2,
          y: box.y + (box.height - iconSize) / 2,
          width: iconSize,
          height: iconSize,
        },
        color: rc?.color ?? tokens.tokens.colors.accent ?? "#4F46E5",
        strokeWidth: DEFAULT_LUCIDE_STROKE_WIDTH,
      })
      continue
      }
      if (isVisualOrIcon && role !== "icon") {
        specs.push({
          kind: "shape",
          regionId: region.id,
          box,
          fill: tokens.tokens.colors.surface ?? "#E2E8F0",
        })
        continue
      }
      continue
    }

    if (!rc?.content?.trim()) continue

    if (rc.kind === "shape" || role.includes("bg")) {
      const patternId = extractPatternFromText(rc.content)
      specs.push({
        kind: "shape",
        regionId: region.id,
        box,
        fill: rc.fill ?? tokens.tokens.colors.surface ?? "#E2E8F0",
        ...(patternId
          ? {
              patternFill: {
                patternId,
                patternColor: rc.color ?? tokens.tokens.colors.accent ?? "#94A3B8",
              },
            }
          : {}),
      })
      continue
    }

    const isHeading =
      role.includes("head") ||
      role.includes("title") ||
      hierarchy[0]?.toLowerCase() === region.role.toLowerCase()

    const typo = resolveTypography({
      content: rc.content,
      regionBox: box,
      constraint: constraints?.regions[region.id],
      importance: region.importance,
      alignment: region.alignment,
      typography,
      isHeading,
    })

    const fit = fitTextToRegion({
      content: rc.content,
      boxWidth: typo.width,
      boxHeight: box.height,
      typography,
      isHeading,
      constraint: constraints?.regions[region.id],
      initialFontSize: typo.fontSize,
      lineHeightRatio: typo.lineHeight,
    })
    const fontSize = fit.fontSize

    textSpecsForHierarchy.push({ fontSize, isHeading })
    specs.push({
      kind: "text",
      regionId: region.id,
      content: rc.content.trim(),
      box: { ...box, width: typo.width },
      fontSize,
      lineHeight: fit.lineHeight,
      fontWeight: rc.fontWeight ?? typo.fontWeight,
      textAlign: rc.textAlign ?? typo.textAlign,
      fontFamily: isHeading ? tokens.tokens.headingFont : tokens.tokens.bodyFont,
      color: tokens.tokens.colors.textPrimary ?? "#0F172A",
    })
  }

  const adjusted = enforceHierarchyScale(textSpecsForHierarchy)
  let ti = 0
  for (const spec of specs) {
    if (spec.kind === "text") {
      spec.fontSize = adjusted[ti]?.fontSize ?? spec.fontSize
      ti++
    }
  }

  const weights = layout.regions
    .map((r) => ({
      id: r.id,
      w: constraints?.regions[r.id]?.visualWeight ?? (r.importance === "primary" ? 0.4 : 0.1),
    }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.id)

  const sectionGap = intentPlan.plan.spacingStrategy?.sectionGap ?? 48

  return {
    regions: specs,
    visualHierarchy: weights.length > 0 ? weights : hierarchy,
    spacingModel: { sectionGap, ctaFooterGap: 48 },
    ...(input.pagePattern ? { pagePattern: input.pagePattern } : {}),
  }
}

export function planFromPattern(
  pattern: LayoutPattern,
  contents: RegionContent[],
  intentPlan: IntentPlanPayload,
  tokens: DesignTokenBundle,
  pageWidth: number,
  pageHeight: number,
  tokenPresetId?: string,
): CompositionPlan {
  const layout = layoutPatternToLayoutTree(pattern)
  const preset = tokenPresetId ? getTokenPresetById(tokenPresetId) : undefined
  return planComposition({
    layout,
    contents,
    intentPlan,
    tokens,
    pageWidth,
    pageHeight,
    tokenPreset: preset,
    constraints: pattern.constraints,
  })
}
