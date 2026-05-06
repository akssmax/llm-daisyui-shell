import type { LlmChatRequest } from "@/lib/llm-types"

export interface StreamChatOptions extends LlmChatRequest {
  onToken: (token: string) => void
  signal?: AbortSignal
}

const RETRY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryStatus(status: number): boolean {
  return status >= 500
}

function parseSseEvent(rawEvent: string): { event: string; data: string } | null {
  const lines = rawEvent
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)

  if (lines.length === 0) return null

  let event = "message"
  const dataParts: string[] = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim()
    } else if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trim())
    }
  }

  return {
    data: dataParts.join("\n"),
    event,
  }
}

async function streamSseResponse(
  response: Response,
  onToken: (token: string) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("Missing response body from /api/chat")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let separatorIndex = buffer.indexOf("\n\n")
    while (separatorIndex !== -1) {
      const chunk = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      const parsed = parseSseEvent(chunk)
      if (!parsed) {
        separatorIndex = buffer.indexOf("\n\n")
        continue
      }

      if (parsed.event === "token") {
        try {
          const payload = JSON.parse(parsed.data) as { text?: string }
          if (payload.text) onToken(payload.text)
        } catch {
          // Ignore malformed token payloads.
        }
      } else if (parsed.event === "error") {
        try {
          const payload = JSON.parse(parsed.data) as { message?: string }
          throw new Error(payload.message || "Streaming failed")
        } catch (error) {
          if (error instanceof Error) throw error
          throw new Error("Streaming failed")
        }
      }

      separatorIndex = buffer.indexOf("\n\n")
    }
  }
}

async function requestChat(
  payload: LlmChatRequest,
  signal: AbortSignal | undefined,
  onToken: (token: string) => void
): Promise<{ emittedTokens: number }> {
  const response = await fetch("/api/chat", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    if (response.status === 404) {
      throw new Error(
        "API route /api/chat not found. Run the app with `vercel dev` so serverless functions are available."
      )
    }
    throw new Error(
      `Request failed (${response.status}): ${errorText || response.statusText || "Unknown error"}`
    )
  }

  let tokenCount = 0
  await streamSseResponse(response, (token) => {
    tokenCount += 1
    onToken(token)
  })

  return { emittedTokens: tokenCount }
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { onToken, signal, ...payload } = options

  try {
    await requestChat(payload, signal, onToken)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isNetworkError = error instanceof TypeError
    const statusMatch = errorMessage.match(/Request failed \((\d+)\):/)
    const status = statusMatch ? Number(statusMatch[1]) : NaN
    const shouldRetry = isNetworkError || (Number.isFinite(status) && shouldRetryStatus(status))

    if (!shouldRetry) throw error

    await sleep(RETRY_DELAY_MS)
    await requestChat(payload, signal, onToken)
  }
}

