export type UserMemory = {
  profile: string
  preferences: string
  facts: string
  retrievalEnabled: boolean
  retrievalMode: "conservative" | "balanced"
  updatedAt: string
}

const USER_MEMORY_STORAGE_KEY = "chatShell.userMemory.v1"
const MEMORY_CHAR_LIMIT = 2_000

const EMPTY_MEMORY: UserMemory = {
  profile: "",
  preferences: "",
  facts: "",
  retrievalEnabled: true,
  retrievalMode: "balanced",
  updatedAt: "",
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function clampText(value: string): string {
  return value.trim().slice(0, MEMORY_CHAR_LIMIT)
}

export function sanitizeUserMemory(memory: Partial<UserMemory>): UserMemory {
  const retrievalMode = memory.retrievalMode === "conservative" ? "conservative" : "balanced"
  return {
    profile: clampText(memory.profile ?? ""),
    preferences: clampText(memory.preferences ?? ""),
    facts: clampText(memory.facts ?? ""),
    retrievalEnabled: memory.retrievalEnabled ?? true,
    retrievalMode,
    updatedAt: memory.updatedAt ?? new Date().toISOString(),
  }
}

export function loadUserMemory(): UserMemory {
  if (!canUseStorage()) return EMPTY_MEMORY
  try {
    const raw = window.localStorage.getItem(USER_MEMORY_STORAGE_KEY)
    if (!raw) return EMPTY_MEMORY
    const parsed = JSON.parse(raw) as Partial<UserMemory>
    return sanitizeUserMemory(parsed)
  } catch {
    return EMPTY_MEMORY
  }
}

export function saveUserMemory(memory: Partial<UserMemory>): UserMemory {
  const next = sanitizeUserMemory(memory)
  if (!canUseStorage()) return next
  window.localStorage.setItem(USER_MEMORY_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearUserMemory(): UserMemory {
  if (canUseStorage()) {
    window.localStorage.removeItem(USER_MEMORY_STORAGE_KEY)
  }
  return EMPTY_MEMORY
}

export function buildMemoryContext(globalMemory: UserMemory, threadMemory: string): string {
  const lines: string[] = []
  if (globalMemory.profile) lines.push(`Profile: ${globalMemory.profile}`)
  if (globalMemory.preferences) lines.push(`Preferences: ${globalMemory.preferences}`)
  if (globalMemory.facts) lines.push(`Facts: ${globalMemory.facts}`)
  if (threadMemory.trim()) lines.push(`Thread memory: ${threadMemory.trim().slice(0, MEMORY_CHAR_LIMIT)}`)
  return lines.join("\n")
}

