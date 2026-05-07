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
  memoryContext?: string
  retrievedContext?: string
  sessionSummary?: string
}

type CompletionStatus = "completed" | "max_tokens_reached"

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
const DEFAULT_MAX_TOKENS = 2400
const MAX_TOKENS_CAP = 12000
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_TIMEOUT_MS = 420_000
const SUGGESTIONS_BUDGET_MS = 350

type GroundedSource = { href: string; title: string }
type GroundedCitation = { href: string; label: string }

function extractGroundedLinks(text: string): GroundedSource[] {
  if (!text.trim()) return []
  const links = new Set<string>()
  const markdownLinkRegex = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g
  const urlRegex = /https?:\/\/[^\s)]+/g

  let markdownMatch = markdownLinkRegex.exec(text)
  while (markdownMatch) {
    links.add(markdownMatch[1])
    markdownMatch = markdownLinkRegex.exec(text)
  }

  const cleanedText = text.replace(markdownLinkRegex, "")
  const urlMatches = cleanedText.match(urlRegex) ?? []
  for (const url of urlMatches) {
    links.add(url)
  }

  return Array.from(links)
    .slice(0, 6)
    .map((href) => {
      try {
        const parsed = new URL(href)
        return {
          href,
          title: parsed.hostname.replace(/^www\./, ""),
        }
      } catch {
        return null
      }
    })
    .filter((item): item is GroundedSource => Boolean(item))
}

function toGroundedCitations(sources: GroundedSource[]): GroundedCitation[] {
  return sources.map((source, index) => ({
    href: source.href,
    label: `Reference ${index + 1}: ${source.title}`,
  }))
}

function buildReasoningSummary(sources: GroundedSource[]): { content: string; durationSeconds?: number } {
  if (sources.length === 0) {
    return { content: "" }
  }
  const domains = sources.slice(0, 2).map((source) => source.title)
  const domainText = domains.join(", ")
  const content =
    sources.length === 1
      ? `Answer grounded in 1 cited source (${domainText}).`
      : `Answer grounded in ${sources.length} cited sources (e.g. ${domainText}).`
  return { content }
}

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

async function generateSuggestionsWithBudget(
  key: string,
  model: string,
  userPrompt: string,
  assistantResponse: string,
  signal: AbortSignal
): Promise<string[]> {
  return Promise.race([
    generateSuggestions(key, model, userPrompt, assistantResponse, signal),
    new Promise<string[]>((resolve) => setTimeout(() => resolve([]), SUGGESTIONS_BUDGET_MS)),
  ])
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveMaxTokens(requestedMaxTokens: number | undefined, messages: ChatMessageInput[]): number {
  if (typeof requestedMaxTokens === "number" && Number.isFinite(requestedMaxTokens)) {
    return clamp(Math.floor(requestedMaxTokens), 256, MAX_TOKENS_CAP)
  }

  const inputTokens = estimateTokens(messages)
  // Scale output budget with conversation size while keeping an upper bound.
  const adaptive = Math.ceil(DEFAULT_MAX_TOKENS + inputTokens * 0.35)
  return clamp(adaptive, DEFAULT_MAX_TOKENS, MAX_TOKENS_CAP)
}

function resolveTimeoutMs(maxTokens: number): number {
  // Time budget scales with output size; clamp to protect server runtime.
  const adaptive = DEFAULT_TIMEOUT_MS + Math.ceil(maxTokens * 25)
  return clamp(adaptive, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
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

  if (body.memoryContext !== undefined && typeof body.memoryContext !== "string") {
    return { code: "invalid_memory_context", message: "memoryContext must be a string.", ok: false, status: 400 }
  }
  if (body.retrievedContext !== undefined && typeof body.retrievedContext !== "string") {
    return { code: "invalid_retrieved_context", message: "retrievedContext must be a string.", ok: false, status: 400 }
  }
  if (body.sessionSummary !== undefined && typeof body.sessionSummary !== "string") {
    return { code: "invalid_session_summary", message: "sessionSummary must be a string.", ok: false, status: 400 }
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
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    const messages = body.messages || []
    const attachments = body.attachments || []
    const memoryPrefix: ChatMessageInput[] = []
    if (body.memoryContext?.trim()) {
      memoryPrefix.push({
        role: "system",
        content: `User memory:\n${body.memoryContext.trim()}`,
      })
    }
    if (body.retrievedContext?.trim()) {
      memoryPrefix.push({
        role: "system",
        content: `Retrieved context:\n${body.retrievedContext.trim()}`,
      })
    }
    if (body.sessionSummary?.trim()) {
      memoryPrefix.push({
        role: "system",
        content: `Session summary:\n${body.sessionSummary.trim()}`,
      })
    }
    const summarized = await summarizeHistory(key, messages, controller.signal)
    const finalMessages = [...memoryPrefix, ...(summarized || messages)]
    const resolvedMaxTokens = resolveMaxTokens(body.maxTokens, finalMessages)
    const timeoutMs = resolveTimeoutMs(resolvedMaxTokens)
    timeout = setTimeout(() => controller.abort("timeout"), timeoutMs)
    const mistralMessages = toMistralMessages(finalMessages, attachments)

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: resolvedMaxTokens,
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
    let finishReason: string | null = null
    const processRawEvent = (rawEvent: string) => {
      const lines = rawEvent.replace(/\r\n/g, "\n").split("\n")
      for (const line of lines) {
        if (!line.startsWith("data:")) continue
        const data = line.slice("data:".length).trim()
        if (!data || data === "[DONE]") continue

        try {
          const payload = JSON.parse(data)
          const choice = payload?.choices?.[0]
          const tokenFromDelta = choice?.delta?.content
          const tokenFromMessage = choice?.message?.content
          if (typeof choice?.finish_reason === "string" && choice.finish_reason.trim().length > 0) {
            finishReason = choice.finish_reason
          }
          const token =
            typeof tokenFromDelta === "string" && tokenFromDelta.length > 0
              ? tokenFromDelta
              : typeof tokenFromMessage === "string" && tokenFromMessage.length > 0
                ? tokenFromMessage
                : null

          if (token) {
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
      const suggestions = await generateSuggestionsWithBudget(
        key,
        body.model || SUMMARY_MODEL,
        lastUserMessage,
        assistantText,
        controller.signal
      )
      if (suggestions.length > 0) {
        writeSse(res, "suggestions", { suggestions })
      }

      const groundedSources = extractGroundedLinks(assistantText)
      if (groundedSources.length > 0) {
        writeSse(res, "sources", { sources: groundedSources })
        writeSse(res, "citations", { citations: toGroundedCitations(groundedSources) })
        const reasoning = buildReasoningSummary(groundedSources)
        if (reasoning.content) {
          writeSse(res, "reasoning", { reasoning })
        }
      }
    } catch {
      // Suggestions are optional; skip on failure.
    }

    const completionStatus: CompletionStatus =
      finishReason === "length" ? "max_tokens_reached" : "completed"
    writeSse(res, "done", {
      ok: true,
      finishReason: finishReason ?? "stop",
      maxTokens: resolvedMaxTokens,
      status: completionStatus,
    })
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
    if (timeout) clearTimeout(timeout)
  }
}

