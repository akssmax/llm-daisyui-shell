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

**Option A — Vercel dev** (runs Vite + serverless `api/*`):

```bash
vercel dev
```

**Option B — Vite + local Node API** (what `vite.config.ts` proxies to on port **3002**):

1. Terminal 1: `npm run dev:api` (requires `MISTRAL_API_KEY` in `.env.local` at the project root)
2. Terminal 2: `npm run dev`

Vite proxies `/api/*` → `http://localhost:3002`. The design editor calls `/api/design-chat`; that route is implemented in `dev-api-server.mjs` and `api/design-chat.ts` (Vercel).

## Deployment (Vercel)

1. In Vercel Project Settings → Environment Variables, add:
   - `MISTRAL_API_KEY` (required for `/api/chat` and **`/api/design-chat`**)
2. Deploy normally.
3. Serverless routes: `api/chat.ts` and `api/design-chat.ts` (same handler; design mode uses the latter).

**If design chat returns `FUNCTION_INVOCATION_FAILED` or 500:** the function is usually hitting the **serverless time limit** while streaming a large response. This repo sets `maxDuration: 60` for both chat routes in [`vercel.json`](vercel.json) (effective on Pro and above; Hobby stays at 10s). Design requests use a **4096** output token cap to finish sooner. You can optionally set **`VERCEL_CHAT_TIMEOUT_MS`** (e.g. `9000` on Hobby) so the upstream Mistral request aborts before the platform hard-kills the function—prefer upgrading plan or shorter prompts if issues persist.

## Mistral chat behavior in v1

- Models: `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest`
- Default model: `mistral-small-latest`
- Streaming protocol: SSE (`text/event-stream`)
- Attachments: max 4 files, up to 5 MB each
- Retry: one automatic retry for network or 5xx failures (500ms delay)
- History: full thread, with auto-summary when conversation is long
