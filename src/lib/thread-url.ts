const THREAD_QUERY_KEY = "thread"

export function getThreadIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get(THREAD_QUERY_KEY)
  const threadId = value?.trim()
  return threadId ? threadId : null
}

export function setThreadIdInUrl(threadId: string, options?: { replace?: boolean }): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.searchParams.set(THREAD_QUERY_KEY, threadId)
  if (options?.replace) {
    window.history.replaceState({}, "", url.toString())
    return
  }
  window.history.pushState({}, "", url.toString())
}

export function onThreadUrlChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("popstate", listener)
  return () => window.removeEventListener("popstate", listener)
}

