import type { UserMemory } from "@/lib/user-memory"

export type RetrievalDecision = {
  shouldUseMemory: boolean
  shouldUseRag: boolean
  reason: string
}

const PERSONAL_CUES = [
  /\bmy\b/i,
  /\bme\b/i,
  /\bremember\b/i,
  /\bi prefer\b/i,
  /\bwhat(?:'s| is)\s+my\b/i,
  /\babout me\b/i,
]

const DOC_CUES_STRONG = [
  /\bdoc(?:ument)?s?\b/i,
  /\bfile\b/i,
  /\.md\b/i,
  /\.txt\b/i,
  /\.json\b/i,
  /\bprd\b/i,
  /\bspec\b/i,
  /\bpolicy\b/i,
  /\bworkflow\b/i,
  /\btable\b/i,
  /\bknowledge\b/i,
]

const DOC_CUES_BALANCED = [
  /\bproject\b/i,
  /\bin our\b/i,
  /\bfrom earlier\b/i,
  /\bbased on\b/i,
  /\baccording to\b/i,
  /\breference\b/i,
]

export function getRetrievalDecision(
  query: string,
  memory: Pick<UserMemory, "retrievalEnabled" | "retrievalMode">
): RetrievalDecision {
  const q = query.trim()
  if (!memory.retrievalEnabled) {
    return { shouldUseMemory: false, shouldUseRag: false, reason: "disabled" }
  }
  if (!q) {
    return { shouldUseMemory: false, shouldUseRag: false, reason: "empty" }
  }

  const hasPersonalCue = PERSONAL_CUES.some((pattern) => pattern.test(q))
  const hasStrongDocCue = DOC_CUES_STRONG.some((pattern) => pattern.test(q))
  const hasBalancedDocCue = DOC_CUES_BALANCED.some((pattern) => pattern.test(q))

  if (memory.retrievalMode === "conservative") {
    return {
      shouldUseMemory: hasPersonalCue,
      shouldUseRag: hasStrongDocCue,
      reason: hasPersonalCue || hasStrongDocCue ? "matched_conservative" : "generic_prompt",
    }
  }

  return {
    shouldUseMemory: hasPersonalCue,
    shouldUseRag: hasStrongDocCue || hasBalancedDocCue,
    reason: hasPersonalCue || hasStrongDocCue || hasBalancedDocCue ? "matched_balanced" : "generic_prompt",
  }
}

