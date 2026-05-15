import type { LayoutConstraints, RegionConstraint } from "./types"
import type { RegionContent } from "../design-compose-assembler"

export type ContentViolation = {
  regionId: string
  message: string
  severity: "low" | "medium" | "high"
}

export function validateContentAgainstConstraints(
  contents: RegionContent[],
  constraints: LayoutConstraints | undefined,
): ContentViolation[] {
  if (!constraints) return []
  const violations: ContentViolation[] = []

  for (const rc of contents) {
    const c: RegionConstraint | undefined = constraints.regions[rc.regionId]
    if (!c || !rc.content?.trim()) continue
    const text = rc.content.trim()
    if (c.maxChars !== undefined && text.length > c.maxChars) {
      violations.push({
        regionId: rc.regionId,
        message: `Content length ${text.length} exceeds maxChars ${c.maxChars}`,
        severity: text.length > c.maxChars * 1.5 ? "high" : "medium",
      })
    }
    if (c.maxLines !== undefined && c.maxLines > 0) {
      const lines = text.split(/\n/).length
      const estLines = Math.ceil(text.length / Math.max(20, (c.maxChars ?? 80) / c.maxLines))
      const lineCount = Math.max(lines, estLines)
      if (lineCount > c.maxLines) {
        violations.push({
          regionId: rc.regionId,
          message: `Estimated ${lineCount} lines exceeds maxLines ${c.maxLines}`,
          severity: "medium",
        })
      }
    }
  }

  return violations
}

export function truncateContentForConstraints(
  contents: RegionContent[],
  constraints: LayoutConstraints | undefined,
): RegionContent[] {
  if (!constraints) return contents
  return contents.map((rc) => {
    const c = constraints.regions[rc.regionId]
    if (!c?.maxChars || !rc.content || rc.content.length <= c.maxChars) return rc
    const trimmed = rc.content.trim()
    if (trimmed.length <= c.maxChars) return { ...rc, content: trimmed }
    const cut = trimmed.slice(0, c.maxChars - 1).trimEnd() + "…"
    return { ...rc, content: cut }
  })
}
