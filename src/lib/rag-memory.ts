export type RagScope = "global" | "thread"
export type RagSourceType = "md" | "txt" | "json"

export type RagSource = {
  id: string
  name: string
  scope: RagScope
  threadId?: string
  type: RagSourceType
  sizeBytes: number
  createdAt: string
  updatedAt: string
}

type RagChunk = {
  id: string
  sourceId: string
  scope: RagScope
  threadId?: string
  text: string
  terms: string[]
  termsSet?: Record<string, true>
}

export type RagSearchResult = {
  sourceId: string
  sourceName: string
  score: number
  text: string
}

const RAG_SOURCES_KEY = "chatShell.rag.sources.v1"
const RAG_CHUNKS_KEY = "chatShell.rag.chunks.v1"
const SUPPORTED_EXTENSIONS = [".md", ".txt", ".json"]
const MAX_SOURCE_TEXT_CHARS = 75_000
const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 180

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function tokenize(value: string): string[] {
  const matches = value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []
  return Array.from(new Set(matches))
}

function readList<T>(key: string): T[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(key: string, value: T[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizeType(filename: string): RagSourceType | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".md")) return "md"
  if (lower.endsWith(".txt")) return "txt"
  if (lower.endsWith(".json")) return "json"
  return null
}

function chunkText(text: string): string[] {
  const normalized = text.trim().slice(0, MAX_SOURCE_TEXT_CHARS)
  if (!normalized) return []
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + CHUNK_SIZE)
    const slice = normalized.slice(start, end).trim()
    if (slice) chunks.push(slice)
    if (end === normalized.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }
  return chunks
}

export function listRagSources(): RagSource[] {
  return readList<RagSource>(RAG_SOURCES_KEY)
}

function listRagChunks(): RagChunk[] {
  return readList<RagChunk>(RAG_CHUNKS_KEY)
}

export function validateRagFile(file: File, maxBytesPerFile: number): string | null {
  const type = normalizeType(file.name)
  if (!type) return `Unsupported file type for ${file.name}. Use .md, .txt, or .json.`
  if (file.size > maxBytesPerFile) {
    return `${file.name} exceeds ${Math.floor(maxBytesPerFile / (1024 * 1024))}MB limit.`
  }
  return null
}

export async function ingestRagFile(params: {
  file: File
  scope: RagScope
  threadId?: string
}): Promise<RagSource> {
  const { file, scope, threadId } = params
  const sourceType = normalizeType(file.name)
  if (!sourceType) throw new Error("Unsupported file format.")
  const text = await file.text()
  const chunks = chunkText(text)
  const now = new Date().toISOString()
  const sourceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const source: RagSource = {
    id: sourceId,
    name: file.name,
    scope,
    threadId: scope === "thread" ? threadId : undefined,
    type: sourceType,
    sizeBytes: file.size,
    createdAt: now,
    updatedAt: now,
  }

  const sources = listRagSources()
  const nextSources = [source, ...sources]
  writeList(RAG_SOURCES_KEY, nextSources)

  const existingChunks = listRagChunks()
  const nextChunks: RagChunk[] = chunks.map((chunk, index) => ({
    id: `${sourceId}-chunk-${index}`,
    sourceId,
    scope,
    threadId: scope === "thread" ? threadId : undefined,
    text: chunk,
    terms: tokenize(chunk),
  }))
  writeList(RAG_CHUNKS_KEY, [...existingChunks, ...nextChunks])
  return source
}

export function deleteRagSource(sourceId: string): void {
  const sources = listRagSources()
  const chunks = listRagChunks()
  const nextSources = sources.filter((source) => source.id !== sourceId)
  writeList(RAG_SOURCES_KEY, nextSources)
  const nextChunks = chunks.filter((chunk) => chunk.sourceId !== sourceId)
  writeList(RAG_CHUNKS_KEY, nextChunks)
}

export function clearRagScope(scope: RagScope, threadId?: string): void {
  const sources = listRagSources()
  const chunks = listRagChunks()
  if (scope === "global") {
    const globalIds = new Set(sources.filter((source) => source.scope === "global").map((source) => source.id))
    writeList(RAG_SOURCES_KEY, sources.filter((source) => source.scope !== "global"))
    writeList(RAG_CHUNKS_KEY, chunks.filter((chunk) => !globalIds.has(chunk.sourceId)))
    return
  }

  const scopedSources = sources.filter((source) => source.scope === "thread" && source.threadId === threadId)
  const scopedIds = new Set(scopedSources.map((source) => source.id))
  writeList(RAG_SOURCES_KEY, sources.filter((source) => !scopedIds.has(source.id)))
  writeList(RAG_CHUNKS_KEY, chunks.filter((chunk) => !scopedIds.has(chunk.sourceId)))
}

export function searchRagMemory(params: {
  query: string
  threadId?: string
  limit?: number
}): RagSearchResult[] {
  const { query, threadId, limit = 4 } = params
  const terms = tokenize(query)
  if (terms.length === 0) return []
  const sources = listRagSources()
  const byId = new Map(sources.map((source) => [source.id, source]))
  const chunks = listRagChunks().filter((chunk) => {
    if (chunk.scope === "global") return true
    return chunk.threadId === threadId
  })
  const scored: Array<{ chunk: RagChunk; score: number }> = []
  for (const chunk of chunks) {
    const lookup =
      chunk.termsSet ??
      (chunk.termsSet = Object.fromEntries(chunk.terms.map((term) => [term, true])) as Record<string, true>)
    let overlap = 0
    for (const term of terms) {
      if (lookup[term]) overlap += 1
    }
    if (overlap === 0) continue
    scored.push({ chunk, score: overlap / terms.length })
  }
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(({ chunk, score }) => ({
    sourceId: chunk.sourceId,
    sourceName: byId.get(chunk.sourceId)?.name ?? "Unknown source",
    score,
    text: chunk.text,
  }))
}

export function buildRetrievedContext(results: RagSearchResult[], maxChars = 2200): string {
  if (results.length === 0) return ""
  let buffer = ""
  for (const result of results) {
    const section = `- [${result.sourceName}] ${result.text}\n`
    if ((buffer + section).length > maxChars) break
    buffer += section
  }
  return buffer.trim()
}

export function getRagFileAcceptString(): string {
  return SUPPORTED_EXTENSIONS.join(",")
}

