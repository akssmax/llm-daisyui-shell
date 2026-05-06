import { nanoid } from "nanoid"

import type { MockChatItem } from "@/lib/mock-chat-data"

const THREADS_STORAGE_KEY = "chatShell.threads.v1"

export type ChatThread = {
  threadId: string
  title: string
  createdAt: string
  updatedAt: string
  messages: MockChatItem[]
}

function nowIso(): string {
  return new Date().toISOString()
}

function sortThreads(threads: ChatThread[]): ChatThread[] {
  return [...threads].sort((a, b) => {
    const aTs = new Date(a.updatedAt).getTime()
    const bTs = new Date(b.updatedAt).getTime()
    return bTs - aTs
  })
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function isThreadShape(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<ChatThread>
  return (
    typeof item.threadId === "string" &&
    typeof item.title === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    Array.isArray(item.messages)
  )
}

export function createChatThread(initial?: Partial<Pick<ChatThread, "title" | "messages">>): ChatThread {
  const timestamp = nowIso()
  return {
    threadId: nanoid(),
    title: initial?.title?.trim() || "New Chat",
    createdAt: timestamp,
    messages: initial?.messages ?? [],
    updatedAt: timestamp,
  }
}

export function loadChatThreads(): ChatThread[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sortThreads(parsed.filter(isThreadShape))
  } catch {
    return []
  }
}

export function saveChatThreads(threads: ChatThread[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(sortThreads(threads)))
}

export function upsertChatThread(threads: ChatThread[], thread: ChatThread): ChatThread[] {
  const existingIndex = threads.findIndex((it) => it.threadId === thread.threadId)
  if (existingIndex === -1) return sortThreads([...threads, thread])
  const next = [...threads]
  next[existingIndex] = thread
  return sortThreads(next)
}

export function updateChatThread(
  threads: ChatThread[],
  threadId: string,
  updater: (thread: ChatThread) => ChatThread
): ChatThread[] {
  const existing = threads.find((it) => it.threadId === threadId)
  if (!existing) return threads
  const updated = updater(existing)
  return upsertChatThread(threads, {
    ...updated,
    updatedAt: nowIso(),
  })
}

