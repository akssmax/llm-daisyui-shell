import designPrinciples from "../knowledge/design-principles.md?raw"
import layoutRecipes from "../knowledge/layout-recipes.md?raw"
import componentLibrary from "../knowledge/component-library.md?raw"

const KNOWLEDGE_BUNDLE = [designPrinciples, layoutRecipes, componentLibrary].join("\n\n---\n\n")

/** Lowercase tokens for naive retrieval. */
function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9+#]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
}

/**
 * Pulls a **small** excerpt from bundled markdown knowledge using heading blocks and keyword hits.
 * Intended for agent phase prompts — not a vector DB.
 */
export function retrieveDesignPatterns(userQuery: string, maxChars = 4500): string {
  const q = userQuery.trim()
  if (!q) return KNOWLEDGE_BUNDLE.slice(0, maxChars)

  const tokens = new Set(tokenize(q))
  if (tokens.size === 0) return KNOWLEDGE_BUNDLE.slice(0, maxChars)

  const sections = KNOWLEDGE_BUNDLE.split(/^## /m).map((s) => s.trim()).filter(Boolean)
  const scored: { score: number; body: string }[] = []

  for (const sec of sections) {
    const titleEnd = sec.indexOf("\n")
    const title = (titleEnd === -1 ? sec : sec.slice(0, titleEnd)).toLowerCase()
    const body = titleEnd === -1 ? "" : sec.slice(titleEnd + 1)
    const hay = (title + "\n" + body).toLowerCase()
    let score = 0
    for (const t of tokens) {
      if (hay.includes(t)) score += title.includes(t) ? 3 : 1
    }
    scored.push({ score, body: "## " + sec })
  }

  scored.sort((a, b) => b.score - a.score)
  const picked: string[] = []
  let len = 0
  for (const { body, score } of scored) {
    if (score === 0 && picked.length > 0) continue
    if (len + body.length > maxChars) {
      const room = maxChars - len - 20
      if (room > 200) picked.push(body.slice(0, room) + "\n…")
      break
    }
    picked.push(body)
    len += body.length + 2
  }

  const out = picked.length > 0 ? picked.join("\n\n") : KNOWLEDGE_BUNDLE.slice(0, maxChars)
  return out.length > maxChars ? out.slice(0, maxChars) + "\n…" : out
}

export function knowledgeBundleCharLength(): number {
  return KNOWLEDGE_BUNDLE.length
}
