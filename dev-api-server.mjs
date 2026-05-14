/**
 * Local dev API server on port 3002.
 * Vite (port 3001) proxies /api/* → http://localhost:3002 (see vite.config.ts).
 * Reads MISTRAL_API_KEY from .env.local (same as vercel dev would).
 */
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Parse .env.local
function loadEnv(filepath) {
  try {
    const raw = fs.readFileSync(filepath, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  } catch {
    // .env.local may not exist
  }
}

loadEnv(path.join(__dirname, ".env.local"))

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY
if (!MISTRAL_API_KEY) {
  console.error("❌  MISTRAL_API_KEY not set in .env.local")
  process.exit(1)
}

const MISTRAL_MODELS = new Set(["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"])
const DEFAULT_MAX_TOKENS = 4096
const MAX_TOKENS_CAP = 12000

function writeSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** Mistral may send `delta.content` as a string or as multimodal parts `[{ type, text }]`. */
function mistralDeltaToText(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  let out = ""
  for (const part of content) {
    if (typeof part === "string") {
      out += part
      continue
    }
    if (part && typeof part === "object" && typeof part.text === "string") out += part.text
  }
  return out
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)) }

async function handleChat(req, res) {
  let body = ""
  for await (const chunk of req) body += chunk
  let parsed
  try { parsed = JSON.parse(body) } catch { parsed = {} }

  const { model, messages, temperature, maxTokens } = parsed

  if (!model || !MISTRAL_MODELS.has(model)) {
    res.writeHead(400, { "Content-Type": "application/json" })
    return res.end(JSON.stringify({ error: { code: "invalid_model", message: "Invalid or missing model." } }))
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" })
    return res.end(JSON.stringify({ error: { code: "invalid_messages", message: "messages must be a non-empty array." } }))
  }

  const resolvedMaxTokens = typeof maxTokens === "number"
    ? clamp(Math.floor(maxTokens), 256, MAX_TOKENS_CAP)
    : DEFAULT_MAX_TOKENS

  const upstream = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: temperature ?? 0.7,
      max_tokens: resolvedMaxTokens,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "")
    res.writeHead(upstream.status || 502, { "Content-Type": "application/json" })
    return res.end(JSON.stringify({ error: { code: "upstream_error", message: text || "Mistral request failed." } }))
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  })

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let upstreamBuffer = ""
  let finishReason = null

  function processRawEvent(rawEvent) {
    const lines = rawEvent.replace(/\r\n/g, "\n").split("\n")
    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      const data = line.slice("data:".length).trim()
      if (!data || data === "[DONE]") continue
      try {
        const payload = JSON.parse(data)
        const choice = payload?.choices?.[0]
        if (typeof choice?.finish_reason === "string" && choice.finish_reason.trim().length > 0) {
          finishReason = choice.finish_reason
        }
        const token =
          mistralDeltaToText(choice?.delta?.content) || mistralDeltaToText(choice?.message?.content)
        if (token.length > 0) {
          writeSse(res, "token", { text: token })
        }
      } catch { /* ignore malformed chunks */ }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      if (upstreamBuffer.trim()) processRawEvent(upstreamBuffer.trim())
      break
    }
    upstreamBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")
    let boundary = upstreamBuffer.indexOf("\n\n")
    while (boundary !== -1) {
      processRawEvent(upstreamBuffer.slice(0, boundary))
      upstreamBuffer = upstreamBuffer.slice(boundary + 2)
      boundary = upstreamBuffer.indexOf("\n\n")
    }
  }

  const completionStatus = finishReason === "length" ? "max_tokens_reached" : "completed"
  writeSse(res, "done", { ok: true, finishReason: finishReason ?? "stop", maxTokens: resolvedMaxTokens, status: completionStatus })
  res.end()
}

function pathnameOnly(url) {
  if (!url) return ""
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

const server = http.createServer(async (req, res) => {
  const path = pathnameOnly(req.url)

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    })
    return res.end()
  }

  if (req.method === "POST" && path === "/api/design-chat") {
    try {
      await handleChat(req, res)
    } catch (err) {
      console.error("Design chat handler error:", err)
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: { code: "chat_failed", message: String(err?.message ?? "Unknown error") } }))
      }
    }
    return
  }

  if (req.method === "POST" && path === "/api/chat") {
    try {
      await handleChat(req, res)
    } catch (err) {
      console.error("Chat handler error:", err)
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: { code: "chat_failed", message: String(err?.message ?? "Unknown error") } }))
      }
    }
    return
  }

  res.writeHead(404, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: "Not found" }))
})

server.listen(3002, () => {
  console.log("✅  Dev API server running on http://localhost:3002")
  console.log("   MISTRAL_API_KEY loaded:", MISTRAL_API_KEY.slice(0, 8) + "…")
})
