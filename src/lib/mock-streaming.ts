export type StreamPhase = "reasoning" | "content"

export async function streamWords({
  text,
  onChunk,
  minDelayMs = 20,
  maxDelayMs = 55,
}: {
  text: string
  onChunk: (nextText: string) => void
  minDelayMs?: number
  maxDelayMs?: number
}) {
  const words = text.split(/\s+/g)
  let current = ""

  for (let i = 0; i < words.length; i += 1) {
    current += (i === 0 ? "" : " ") + words[i]
    onChunk(current)

    const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1) + minDelayMs)
    await new Promise((r) => setTimeout(r, delay))
  }
}

