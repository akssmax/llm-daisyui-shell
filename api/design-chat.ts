/**
 * Design-mode chat: same streaming protocol as /api/chat.
 * Route exists for proxies, rate limits, and future design-specific tool SSE.
 */
import chatHandler from "./chat"
export default chatHandler
