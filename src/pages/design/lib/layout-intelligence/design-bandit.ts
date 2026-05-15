import type { ContentProfile } from "./content-profile"
import { contentProfileBucket } from "./content-profile"

const DB_NAME = "design-intelligence-memory"
const DB_VERSION = 2
const BANDIT_STORE = "bandit_arms"

export type BanditArm = {
  key: string
  contextKey: string
  layoutId: string
  alpha: number
  beta: number
  pulls: number
  totalReward: number
}

let memoryCache: Map<string, BanditArm> | null = null

function armKey(contextKey: string, layoutId: string): string {
  return `${contextKey}::${layoutId}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (ev) => {
      const db = req.result
      const oldVersion = ev.oldVersion
      if (oldVersion < 1 && !db.objectStoreNames.contains("records")) {
        const os = db.createObjectStore("records", { keyPath: "id" })
        os.createIndex("layoutId", "layoutId", { unique: false })
        os.createIndex("category", "category", { unique: false })
        os.createIndex("timestamp", "timestamp", { unique: false })
      }
      if (!db.objectStoreNames.contains(BANDIT_STORE)) {
        db.createObjectStore(BANDIT_STORE, { keyPath: "key" })
      }
    }
  })
}

async function loadArms(): Promise<Map<string, BanditArm>> {
  if (memoryCache) return memoryCache
  if (typeof indexedDB === "undefined") {
    memoryCache = new Map()
    return memoryCache
  }
  const db = await openDb()
  const arms = await new Promise<BanditArm[]>((resolve, reject) => {
    const tx = db.transaction(BANDIT_STORE, "readonly")
    const req = tx.objectStore(BANDIT_STORE).getAll()
    req.onsuccess = () => resolve((req.result as BanditArm[]) ?? [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  memoryCache = new Map(arms.map((a) => [a.key, a]))
  return memoryCache
}

async function persistArm(arm: BanditArm): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BANDIT_STORE, "readwrite")
    tx.objectStore(BANDIT_STORE).put(arm)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  const cache = await loadArms()
  cache.set(arm.key, arm)
}

function defaultArm(contextKey: string, layoutId: string): BanditArm {
  return {
    key: armKey(contextKey, layoutId),
    contextKey,
    layoutId,
    alpha: 1,
    beta: 1,
    pulls: 0,
    totalReward: 0,
  }
}

/** Thompson sample mean reward in [0, 1] for ranking. */
export function getBanditReward(contextKey: string, layoutId: string): number {
  const arm = memoryCache?.get(armKey(contextKey, layoutId))
  if (!arm || arm.pulls === 0) return 0
  return arm.totalReward / arm.pulls
}

export async function initBanditCache(): Promise<void> {
  await loadArms()
}

export function buildBanditContextKey(
  category: string,
  profile: ContentProfile,
  tone: string,
): string {
  return `${category}:${contentProfileBucket(profile)}:${tone}`
}

export async function recordBanditReward(
  contextKey: string,
  layoutId: string,
  reward: number,
): Promise<void> {
  const arms = await loadArms()
  const key = armKey(contextKey, layoutId)
  const arm = arms.get(key) ?? defaultArm(contextKey, layoutId)
  const clamped = Math.max(-1, Math.min(1, reward))
  arm.pulls += 1
  arm.totalReward += clamped
  if (clamped > 0) arm.alpha += clamped
  else arm.beta += Math.abs(clamped)
  arms.set(key, arm)
  await persistArm(arm)
}

export async function rateBanditLayout(
  contextKey: string,
  layoutId: string,
  rating: 1 | -1,
): Promise<void> {
  await recordBanditReward(contextKey, layoutId, rating === 1 ? 1 : -0.5)
}

/** Epsilon-greedy pick among layout ids (sync, uses cache). */
export function pickBanditLayout(
  contextKey: string,
  layoutIds: string[],
  epsilon = 0.12,
): string | null {
  if (layoutIds.length === 0) return null
  if (Math.random() < epsilon) {
    return layoutIds[Math.floor(Math.random() * layoutIds.length)]!
  }
  let best = layoutIds[0]!
  let bestScore = -Infinity
  for (const id of layoutIds) {
    const arm = memoryCache?.get(armKey(contextKey, id))
    const mean = arm && arm.pulls > 0 ? arm.totalReward / arm.pulls : 0
    const exploration = arm ? Math.sqrt(2 * Math.log(arm.pulls + 2) / (arm.pulls + 1)) : 0.5
    const score = mean + exploration
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }
  return best
}
