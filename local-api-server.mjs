import { createServer } from "http"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
try {
  const envFile = readFileSync(resolve(__dirname, ".env.local"), "utf8")
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
} catch {}

// Inline a minimal version of the handler using Vercel-compatible request/response API
const PORT = 3002

function jsonError(res, status, code, message) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: { code, message } }))
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end()
    return
  }

  res.setHeader("Access-Control-Allow-Origin", "*")

  if (!req.url?.startsWith("/api/chat") && !req.url?.startsWith("/api/design-chat")) {
    res.writeHead(404)
    res.end("Not found")
    return
  }

  // Buffer the body
  let bodyStr = ""
  for await (const chunk of req) bodyStr += chunk
  let body
  try {
    body = JSON.parse(bodyStr)
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: { code: "invalid_json", message: "Request body must be JSON." } }))
    return
  }

  // Wrap req/res to match the Vercel handler interface
  const apiReq = { method: req.method, body }
  const apiRes = {
    headersSent: false,
    _status: 200,
    status(code) { this._status = code; return this },
    setHeader(name, value) { if (!this.headersSent) res.setHeader(name, value) },
    write(chunk) {
      if (!this.headersSent) {
        res.writeHead(this._status)
        this.headersSent = true
      }
      res.write(chunk)
    },
    json(data) {
      if (!this.headersSent) {
        res.writeHead(this._status, { "Content-Type": "application/json" })
        this.headersSent = true
      }
      res.end(JSON.stringify(data))
    },
    end() {
      if (!this.headersSent) {
        res.writeHead(this._status)
        this.headersSent = true
      }
      res.end()
    },
  }

  try {
    // Dynamically import the compiled handler via tsx
    const { default: handler } = await import(
      `./api/chat.ts?t=${Date.now()}`,
      { with: { type: "typescript" } }
    ).catch(() => null) ?? {}

    if (!handler) {
      // Fallback: load via child process with tsx
      jsonError(apiRes, 500, "handler_load_failed", "Could not load api/chat.ts. Make sure tsx is available.")
      return
    }

    await handler(apiReq, apiRes)
  } catch (err) {
    console.error("Handler error:", err)
    if (!apiRes.headersSent) {
      jsonError(apiRes, 500, "handler_error", err?.message ?? "Unknown error")
    }
  }
})

server.listen(PORT, () => {
  console.log(`Local API server running at http://localhost:${PORT}`)
})
