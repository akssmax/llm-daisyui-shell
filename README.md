# Chat Shell (Mistral v1)

This project now supports a Mistral-backed streaming chat flow via a Vercel API route.

## Environment setup

1. Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

2. Set your key:

```bash
MISTRAL_API_KEY=...
```

`MISTRAL_API_KEY` is server-side only and must never be exposed as a `VITE_*` variable.

## Local development

- Frontend only (no API): `npm run dev` (Vite on port **3001**)
- Full stack with `/api/chat` and **`/api/design-chat`** (same handler as chat):

**Option A — Vercel dev** (runs Vite + serverless `api/*`; `dev:vercel` disables the `/api` proxy so routes are not sent to port 3002):

```bash
vercel dev
```

Open the URL Vercel prints (usually **http://localhost:3000**), not Vite’s **3001** directly.

**Option B — Vite + local Node API** (what `vite.config.ts` proxies to on port **3002**):

1. Terminal 1: `npm run dev:api` (requires `MISTRAL_API_KEY` in `.env.local` at the project root)
2. Terminal 2: `npm run dev`

Vite proxies `/api/*` → `http://localhost:3002`. The design editor posts to **`/api/chat`** (same handler as main chat). `dev-api-server.mjs` also serves `/api/design-chat` as an alias for local parity.

## Deployment (Vercel)

1. In Vercel Project Settings → Environment Variables, add:
   - `MISTRAL_API_KEY` (required for **`/api/chat`**, used by both main and design chat)
2. Deploy normally.
3. Serverless: `api/chat.ts` serves design mode and main chat. Optional `api/design-chat.ts` re-exports the same handler.

**If design chat returns `FUNCTION_INVOCATION_FAILED` or 500:** the function is usually hitting the **serverless time limit** while streaming. This repo sets `maxDuration: 120` for chat routes in [`vercel.json`](vercel.json) on plans that allow it (**Hobby is still capped at 10s**). Design mode requests up to **12_000** output tokens (server cap in `api/chat.ts`); the upstream abort budget on Vercel scales with that unless you set **`VERCEL_CHAT_TIMEOUT_MS`** yourself (milliseconds, caps the Mistral stream wait).

**Truncated JSON / “cut off” replies:** usually **output token limit** (`finish_reason: length`) or **wall-clock limit** on Hobby. Use **Continue** in the design panel when offered, ask for smaller edits, or upgrade the Vercel plan so `maxDuration` applies beyond 10s.

**Large canvases with embedded images:** the design system prompt **replaces image `data:` URLs with short placeholders** before calling the API so request bodies stay within Vercel limits (multi‑MB base64 in JSON was a common cause of design-only failures while normal chat still worked).

## Mistral chat behavior in v1

- Models: `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest`
- Default model: `mistral-small-latest`
- Streaming protocol: SSE (`text/event-stream`)
- Attachments: max 4 files, up to 5 MB each
- Retry: one automatic retry for network or 5xx failures (500ms delay)
- History: full thread, with auto-summary when conversation is long
