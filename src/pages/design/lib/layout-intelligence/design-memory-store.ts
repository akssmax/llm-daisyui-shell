import { nanoid } from "nanoid"
import type { DesignMemoryRecord, LayoutMemorySignals } from "./types"

const DB_NAME = "design-intelligence-memory"
const DB_VERSION = 1
const STORE = "records"
const MAX_RECORDS = 500
const DECAY_HALF_LIFE_MS = 90 * 24 * 60 * 60 * 1000

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" })
        os.createIndex("layoutId", "layoutId", { unique: false })
        os.createIndex("category", "category", { unique: false })
        os.createIndex("timestamp", "timestamp", { unique: false })
      }
    }
  })
}

function decayWeight(timestamp: number): number {
  const age = Date.now() - timestamp
  return Math.pow(0.5, age / DECAY_HALF_LIFE_MS)
}

export async function recordDesignMemory(
  record: Omit<DesignMemoryRecord, "id" | "timestamp">,
): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDb()
  const full: DesignMemoryRecord = {
    ...record,
    id: nanoid(),
    timestamp: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(full)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  await pruneOldRecords()
}

async function pruneOldRecords(): Promise<void> {
  const db = await openDb()
  const all = await getAllRecords(db)
  if (all.length <= MAX_RECORDS) {
    db.close()
    return
  }
  const sorted = all.sort((a, b) => b.timestamp - a.timestamp)
  const toDelete = sorted.slice(MAX_RECORDS)
  const tx = db.transaction(STORE, "readwrite")
  const store = tx.objectStore(STORE)
  for (const r of toDelete) store.delete(r.id)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

function getAllRecords(db: IDBDatabase): Promise<DesignMemoryRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as DesignMemoryRecord[])
    req.onerror = () => reject(req.error)
  })
}

export async function getLayoutMemorySignals(category?: string): Promise<LayoutMemorySignals> {
  if (typeof indexedDB === "undefined") return { layoutScores: {} }
  const db = await openDb()
  const all = await getAllRecords(db)
  db.close()

  const scores: Record<string, number> = {}
  for (const r of all) {
    if (category && r.category !== category) continue
    let signal = 0
    if (r.userRating === 1) signal += 1
    else if (r.userRating === -1) signal -= 0.5
    else if (r.applied && r.critiqueScore >= 70) signal += 0.5
    else if (r.applied) signal += 0.2
    signal *= decayWeight(r.timestamp)
    scores[r.layoutId] = (scores[r.layoutId] ?? 0) + signal
  }
  return { layoutScores: scores }
}

export async function updateDesignMemoryRating(
  layoutId: string,
  rating: 1 | -1,
  category: string,
): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDb()
  const all = await getAllRecords(db)
  const match = all
    .filter((r) => r.layoutId === layoutId && r.category === category)
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (match) {
    match.userRating = rating
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(match)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
  db.close()
}

export function hashPrompt(prompt: string): string {
  let h = 0
  const s = prompt.trim().toLowerCase()
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return String(h)
}
