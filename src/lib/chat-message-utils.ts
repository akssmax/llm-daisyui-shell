import type { UIMessage } from "ai"

import type { MockChatItem } from "@/lib/mock-chat-data"

export function replaceMessageById(
  prev: MockChatItem[],
  id: string,
  updater: (item: MockChatItem) => MockChatItem
): MockChatItem[] {
  const index = prev.findIndex((it) => it.id === id)
  if (index === -1) return prev
  const next = prev.slice()
  next[index] = updater(prev[index]!)
  return next
}

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function estimateTokenCount(text: string): number {
  if (!text.trim()) return 0
  return Math.ceil(text.length / 4)
}

export function toTextMessage(id: string, role: UIMessage["role"], text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] }
}
