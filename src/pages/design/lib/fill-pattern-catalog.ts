export const PATTERN_IDS = [
  "dots",
  "dots-sparse",
  "grid",
  "grid-light",
  "diagonal-lines",
  "crosshatch",
  "horizontal-stripes",
  "vertical-stripes",
  "waves",
  "zigzag",
  "noise-subtle",
  "checker-soft",
] as const

export type PatternId = (typeof PATTERN_IDS)[number]

const PATTERN_SET = new Set<string>(PATTERN_IDS)

const TILE_SIZE = 64

const tileCache = new Map<string, HTMLCanvasElement>()

function normalizePatternId(raw: string): PatternId | null {
  const id = raw.trim().toLowerCase().replace(/\s+/g, "-")
  if (PATTERN_SET.has(id)) return id as PatternId
  if (id === "dot" || id === "dotted") return "dots"
  if (id === "stripes") return "horizontal-stripes"
  return null
}

function drawPattern(ctx: CanvasRenderingContext2D, id: PatternId, fg: string, bg: string) {
  const s = TILE_SIZE
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = fg
  ctx.fillStyle = fg

  switch (id) {
    case "dots":
      for (let x = 8; x < s; x += 16) {
        for (let y = 8; y < s; y += 16) {
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    case "dots-sparse":
      for (let x = 12; x < s; x += 24) {
        for (let y = 12; y < s; y += 24) {
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    case "grid":
      ctx.lineWidth = 1
      for (let i = 0; i <= s; i += 16) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, s)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(s, i)
        ctx.stroke()
      }
      break
    case "grid-light":
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 1
      for (let i = 0; i <= s; i += 16) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, s)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(s, i)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    case "diagonal-lines":
      ctx.lineWidth = 1
      for (let i = -s; i < s * 2; i += 12) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + s, s)
        ctx.stroke()
      }
      break
    case "crosshatch":
      ctx.lineWidth = 1
      for (let i = -s; i < s * 2; i += 10) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + s, s)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(i, s)
        ctx.lineTo(i + s, 0)
        ctx.stroke()
      }
      break
    case "horizontal-stripes":
      ctx.lineWidth = 4
      for (let y = 0; y < s; y += 12) {
        ctx.beginPath()
        ctx.moveTo(0, y + 2)
        ctx.lineTo(s, y + 2)
        ctx.stroke()
      }
      break
    case "vertical-stripes":
      ctx.lineWidth = 4
      for (let x = 0; x < s; x += 12) {
        ctx.beginPath()
        ctx.moveTo(x + 2, 0)
        ctx.lineTo(x + 2, s)
        ctx.stroke()
      }
      break
    case "waves":
      ctx.lineWidth = 2
      for (let y = 8; y < s; y += 16) {
        ctx.beginPath()
        for (let x = 0; x <= s; x += 4) {
          const py = y + Math.sin((x / s) * Math.PI * 4) * 4
          if (x === 0) ctx.moveTo(x, py)
          else ctx.lineTo(x, py)
        }
        ctx.stroke()
      }
      break
    case "zigzag":
      ctx.lineWidth = 2
      for (let y = 10; y < s; y += 20) {
        ctx.beginPath()
        for (let x = 0; x <= s; x += 8) {
          const py = y + (x / 8) % 2 === 0 ? 0 : 8
          if (x === 0) ctx.moveTo(x, py)
          else ctx.lineTo(x, py)
        }
        ctx.stroke()
      }
      break
    case "noise-subtle": {
      const img = ctx.createImageData(s, s)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = Math.random() * 40
        img.data[i] = n
        img.data[i + 1] = n
        img.data[i + 2] = n
        img.data[i + 3] = 18
      }
      ctx.putImageData(img, 0, 0)
      break
    }
    case "checker-soft":
      ctx.globalAlpha = 0.2
      for (let x = 0; x < s; x += 16) {
        for (let y = 0; y < s; y += 16) {
          if ((x / 16 + y / 16) % 2 === 0) {
            ctx.fillStyle = fg
            ctx.fillRect(x, y, 16, 16)
          }
        }
      }
      ctx.globalAlpha = 1
      break
  }
}

export function getPatternTile(
  patternId: string,
  patternColor: string,
  backgroundColor = "#ffffff",
): HTMLCanvasElement | null {
  const id = normalizePatternId(patternId)
  if (!id) return null
  const key = `${id}|${patternColor}|${backgroundColor}`
  const cached = tileCache.get(key)
  if (cached) return cached

  const canvas = document.createElement("canvas")
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  drawPattern(ctx, id, patternColor, backgroundColor)
  tileCache.set(key, canvas)
  return canvas
}

export function patternsForPrompt(): string {
  return PATTERN_IDS.map((id) => `${id} (decorative tile)`).join("; ")
}

export function parsePatternId(raw: string): PatternId | null {
  return normalizePatternId(raw)
}

export { TILE_SIZE as PATTERN_TILE_SIZE }
