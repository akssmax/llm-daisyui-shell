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

- Frontend only (no API): `npm run dev`
- Full stack with `/api/chat` route: run with Vercel dev so serverless functions are available:

```bash
vercel dev
```

## Deployment (Vercel)

1. In Vercel Project Settings -> Environment Variables, add:
   - `MISTRAL_API_KEY`
2. Deploy normally.
3. The client calls `/api/chat`; Vercel runs `api/chat.ts` server-side and keeps the key hidden.

## Mistral chat behavior in v1

- Models: `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest`
- Default model: `mistral-small-latest`
- Streaming protocol: SSE (`text/event-stream`)
- Attachments: max 4 files, up to 5 MB each
- Retry: one automatic retry for network or 5xx failures (500ms delay)
- History: full thread, with auto-summary when conversation is long
