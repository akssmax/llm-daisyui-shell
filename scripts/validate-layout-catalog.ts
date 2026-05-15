/**
 * Validates layout catalog JSON files.
 * Run: npx tsx scripts/validate-layout-catalog.ts
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const layoutsDir = join(__dirname, "..", "data", "layouts")

type Region = {
  id: string
  role: string
  relativeRect: { x: number; y: number; w: number; h: number }
  alignment: string
  importance: string
}

type Layout = {
  id: string
  category: string
  archetype: string
  grid: { columns: number; safeMargin: number }
  regions: Region[]
}

const COL = 1 / 12
let errors = 0

function fail(msg: string) {
  console.error(`❌ ${msg}`)
  errors++
}

function snap12(n: number): boolean {
  const steps = Math.round(n / COL)
  return Math.abs(n - steps * COL) < 0.02
}

for (const file of readdirSync(layoutsDir).filter((f) => f.endsWith(".json"))) {
  const layout = JSON.parse(readFileSync(join(layoutsDir, file), "utf8")) as Layout
  if (!layout.id) fail(`${file}: missing id`)
  if (layout.grid?.columns !== 12) fail(`${layout.id}: grid.columns must be 12`)
  if (layout.grid?.safeMargin < 64) fail(`${layout.id}: safeMargin must be >= 64`)

  const regions = layout.regions ?? []
  if (regions.length === 0) fail(`${layout.id}: no regions`)

  for (const r of regions) {
    const { x, y, w, h } = r.relativeRect
    if (x < 0 || y < 0 || w <= 0 || h <= 0) fail(`${layout.id}/${r.id}: invalid rect`)
    if (x + w > 1.01 || y + h > 1.01) fail(`${layout.id}/${r.id}: rect exceeds bounds`)
    if (!snap12(x) || !snap12(w)) fail(`${layout.id}/${r.id}: x/w not on 12-col grid`)
  }

  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i]!.relativeRect
      const b = regions[j]!.relativeRect
      const overlap =
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      if (overlap) {
        const areaA = a.w * a.h
        const areaB = b.w * b.h
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
        const overlapRatio = (ix * iy) / Math.min(areaA, areaB)
        if (overlapRatio > 0.15) {
          fail(`${layout.id}: regions ${regions[i]!.id} & ${regions[j]!.id} overlap >15%`)
        }
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s)`)
  process.exit(1)
}

console.log(`✅ All ${readdirSync(layoutsDir).filter((f) => f.endsWith(".json")).length} layouts valid`)
