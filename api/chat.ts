type ChatRole = "system" | "user" | "assistant"

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  end: () => void
  headersSent: boolean
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
  write: (chunk: string) => void
}

type AttachmentInput = {
  filename?: string
  mediaType?: string
  type?: string
  url?: string
}

type ChatMessageInput = {
  role: ChatRole
  content: string
}

type ChatRequestBody = {
  model?: string
  messages?: ChatMessageInput[]
  attachments?: AttachmentInput[]
  temperature?: number
  maxTokens?: number
}

const MISTRAL_MODELS = new Set([
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
])
const SUMMARY_MODEL = "mistral-small-latest"
const MAX_ATTACHMENTS = 4
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const MAX_MESSAGES = 200
const SUMMARY_MESSAGE_TRIGGER = 40
const SUMMARY_TOKEN_TRIGGER = 12000
const REQUEST_TIMEOUT_MS = 60_000
const DEFAULT_MAX_TOKENS = 1200

function parseSuggestions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const cleaned = parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
    return Array.from(new Set(cleaned)).slice(0, 4)
  } catch {
    return []
  }
}

async function generateSuggestions(
  key: string,
  model: string,
  userPrompt: string,
  assistantResponse: string,
  signal: AbortSignal
): Promise<string[]> {
  if (!assistantResponse.trim()) return []

  const prompt = [
    "Generate 3 short follow-up suggestions for the user based on this assistant answer.",
    "Rules:",
    "- Return strict JSON array only (no markdown).",
    "- Each suggestion <= 8 words.",
    "- Suggestions should be actionable and distinct.",
    "",
    `User prompt: ${userPrompt}`,
    "",
    `Assistant answer: ${assistantResponse}`,
  ].join("\n")

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    body: JSON.stringify({
      max_tokens: 120,
      messages: [{ content: prompt, role: "user" }],
      model,
      stream: false,
      temperature: 0.3,
    }),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  })

  if (!response.ok) return []

  const json = await response.json()
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== "string") return []
  return parseSuggestions(content)
}

function jsonError(res: ApiResponse, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } })
}

function writeSse(res: ApiResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function estimateTokens(messages: ChatMessageInput[]): number {
  const text = messages.map((m) => m.content).join("\n")
  return Math.ceil(text.length / 4)
}

function getDataUrlBytes(url: string): number {
  const parts = url.split(",")
  if (parts.length !== 2) return 0
  const base64 = parts[1]
  return Math.floor((base64.length * 3) / 4)
}

function validateRequest(body: ChatRequestBody): { ok: true } | { ok: false; status: number; code: string; message: string } {
  if (!body.model || !MISTRAL_MODELS.has(body.model)) {
    return { code: "invalid_model", message: "Invalid or missing model.", ok: false, status: 400 }
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { code: "invalid_messages", message: "messages must be a non-empty array.", ok: false, status: 400 }
  }

  if (body.messages.length > MAX_MESSAGES) {
    return { code: "message_limit", message: `messages exceeds max of ${MAX_MESSAGES}.`, ok: false, status: 400 }
  }

  for (const message of body.messages) {
    if (!["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      return { code: "invalid_message_shape", message: "Each message requires role and string content.", ok: false, status: 400 }
    }
  }

  if (body.attachments && !Array.isArray(body.attachments)) {
    return { code: "invalid_attachments", message: "attachments must be an array.", ok: false, status: 400 }
  }

  if (body.attachments && body.attachments.length > MAX_ATTACHMENTS) {
    return {
      code: "attachment_limit",
      message: `attachments exceeds max of ${MAX_ATTACHMENTS}.`,
      ok: false,
      status: 400,
    }
  }

  for (const file of body.attachments || []) {
    if (typeof file.url !== "string" || !file.url.includes(",")) {
      return { code: "invalid_attachment_url", message: "Each attachment needs a data URL.", ok: false, status: 400 }
    }
    const bytes = getDataUrlBytes(file.url)
    if (bytes > MAX_ATTACHMENT_BYTES) {
      return {
        code: "attachment_size_limit",
        message: `Attachment ${file.filename || "file"} exceeds 5MB limit.`,
        ok: false,
        status: 400,
      }
    }
  }

  return { ok: true }
}

function buildUserContent(message: string, attachments: AttachmentInput[]) {
  const parts: Array<Record<string, unknown>> = [{ text: message, type: "text" }]

  for (const attachment of attachments) {
    if (!attachment.url) continue
    if (attachment.mediaType?.startsWith("image/")) {
      parts.push({
        image_url: attachment.url,
        type: "image_url",
      })
      continue
    }

    parts.push({
      document_url: attachment.url,
      type: "document_url",
    })
    parts.push({
      text: `Attachment: ${attachment.filename || "file"} (${attachment.mediaType || "unknown"})`,
      type: "text",
    })
  }

  return parts
}

async function summarizeHistory(
  key: string,
  messages: ChatMessageInput[],
  signal: AbortSignal
): Promise<ChatMessageInput[] | null> {
  const shouldSummarize =
    messages.length > SUMMARY_MESSAGE_TRIGGER || estimateTokens(messages) > SUMMARY_TOKEN_TRIGGER

  if (!shouldSummarize) return null
  if (messages.length < 14) return null

  const head = messages.slice(0, Math.max(0, messages.length - 12))
  const tail = messages.slice(-12)

  const prompt = [
    "Summarize the conversation history for another assistant call.",
    "Capture user goals, hard requirements, constraints, decisions, unresolved questions, and attachment context.",
    "Be concise and factual.",
    "",
    ...head.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
  ].join("\n")

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    body: JSON.stringify({
      max_tokens: 600,
      messages: [{ content: prompt, role: "user" }],
      model: SUMMARY_MODEL,
      stream: false,
      temperature: 0.2,
    }),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  })

  if (!response.ok) return null

  const json = await response.json()
  const summary = json?.choices?.[0]?.message?.content
  if (typeof summary !== "string" || summary.trim().length === 0) return null

  return [
    {
      content: `Conversation summary:\n${summary.trim()}`,
      role: "system",
    },
    ...tail,
  ]
}

function toMistralMessages(messages: ChatMessageInput[], attachments: AttachmentInput[]) {
  const output: Array<Record<string, unknown>> = []
  let userAttachmentInjected = false

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    const isLastUserMessage = message.role === "user" && i === messages.length - 1

    if (isLastUserMessage && attachments.length > 0 && !userAttachmentInjected) {
      output.push({
        content: buildUserContent(message.content, attachments),
        role: "user",
      })
      userAttachmentInjected = true
      continue
    }

    output.push({
      content: message.content,
      role: message.role,
    })
  }

  return output
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "method_not_allowed", "Only POST is supported.")
  }

  const key = process.env.MISTRAL_API_KEY
  if (!key) {
    return jsonError(res, 500, "missing_api_key", "MISTRAL_API_KEY is not configured.")
  }

  const body = (req.body || {}) as ChatRequestBody
  const validation = validateRequest(body)
  if (!validation.ok) {
    return jsonError(res, validation.status, validation.code, validation.message)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS)

  try {
    const messages = body.messages || []
    const attachments = body.attachments || []
    const summarized = await summarizeHistory(key, messages, controller.signal)
    const finalMessages = summarized || messages
    const mistralMessages = toMistralMessages(finalMessages, attachments)

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: body.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: mistralMessages,
        model: body.model,
        stream: true,
        temperature: body.temperature ?? 0.7,
      }),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "")
      return jsonError(
        res,
        response.status || 502,
        "upstream_error",
        text || "Mistral request failed."
      )
    }

    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
    res.setHeader("X-Accel-Buffering", "no")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let upstreamBuffer = ""
    let assistantText = ""
    const processRawEvent = (rawEvent: string) => {
      const lines = rawEvent.replace(/\r\n/g, "\n").split("\n")
      for (const line of lines) {
        if (!line.startsWith("data:")) continue
        const data = line.slice("data:".length).trim()
        if (!data || data === "[DONE]") continue

        try {
          const payload = JSON.parse(data)
          const token = payload?.choices?.[0]?.delta?.content
          if (typeof token === "string" && token.length > 0) {
            assistantText += token
            writeSse(res, "token", { text: token })
          }
        } catch {
          // Ignore malformed upstream chunks.
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        const trailingEvent = upstreamBuffer.trim()
        if (trailingEvent) {
          processRawEvent(trailingEvent)
        }
        break
      }
      upstreamBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")

      let boundary = upstreamBuffer.indexOf("\n\n")
      while (boundary !== -1) {
        const rawEvent = upstreamBuffer.slice(0, boundary)
        upstreamBuffer = upstreamBuffer.slice(boundary + 2)
        processRawEvent(rawEvent)

        boundary = upstreamBuffer.indexOf("\n\n")
      }
    }

    try {
      const lastUserMessage =
        [...messages].reverse().find((message) => message.role === "user")?.content ?? ""
      const suggestions = await generateSuggestions(
        key,
        body.model || SUMMARY_MODEL,
        lastUserMessage,
        assistantText,
        controller.signal
      )
      if (suggestions.length > 0) {
        writeSse(res, "suggestions", { suggestions })
      }
    } catch {
      // Suggestions are optional; skip on failure.
    }

    writeSse(res, "done", { ok: true })
    res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed"
    const isAborted = message.includes("abort") || message.includes("timeout")
    const status = isAborted ? 504 : 500

    console.error(
      JSON.stringify({
        error: message,
        event: "chat_api_error",
        status,
      })
    )

    if (!res.headersSent) {
      return jsonError(
        res,
        status,
        isAborted ? "request_timeout" : "chat_failed",
        isAborted ? "Request timed out." : "Chat request failed."
      )
    }

    writeSse(res, "error", {
      message: isAborted ? "Request timed out." : "Chat request failed.",
    })
    res.end()
  } finally {
    clearTimeout(timeout)
  }
}

