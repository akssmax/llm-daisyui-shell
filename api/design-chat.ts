/**
 * Design-mode chat API entry.
 *
 * Uses the same handler as `/api/chat` (Mistral streaming). When the request body includes
 * `designAgentPhase` / `designAgentPhaseLabel`, the stream emits extra `agent_phase` SSE events
 * for the design agent UI (see `api/chat.ts`).
 *
 * Proxied from Vite dev server (`/api/design-chat` → dev-api-server) like `/api/chat`.
 */
import chatHandler from "./chat"
export default chatHandler
