import { nanoid } from "nanoid"
import type { DesignDocument } from "@/pages/design/types"

const SESSIONS_STORAGE_KEY = "chatShell.designSessions.v1"

export type DesignSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  document: DesignDocument | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function sortSessions(sessions: DesignSession[]): DesignSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function isSessionShape(value: unknown): value is DesignSession {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<DesignSession>
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  )
}

export function createDesignSession(title = "New Design"): DesignSession {
  const timestamp = nowIso()
  return { id: nanoid(), title, createdAt: timestamp, updatedAt: timestamp, document: null }
}

export function loadDesignSessions(): DesignSession[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sortSessions(parsed.filter(isSessionShape))
  } catch {
    return []
  }
}

export function saveDesignSessions(sessions: DesignSession[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
}

export function upsertDesignSession(
  sessions: DesignSession[],
  session: DesignSession,
): DesignSession[] {
  const idx = sessions.findIndex((s) => s.id === session.id)
  const next = idx === -1 ? [...sessions, session] : sessions.map((s, i) => (i === idx ? session : s))
  return sortSessions(next)
}

export function updateDesignSession(
  sessions: DesignSession[],
  id: string,
  updater: (s: DesignSession) => Partial<DesignSession>,
): DesignSession[] {
  const existing = sessions.find((s) => s.id === id)
  if (!existing) return sessions
  return upsertDesignSession(sessions, { ...existing, ...updater(existing), updatedAt: nowIso() })
}
