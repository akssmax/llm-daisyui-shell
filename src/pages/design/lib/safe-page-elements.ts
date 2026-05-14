import type { DesignElement } from "../types"

/** Runtime guard: LLM / persisted JSON may omit or corrupt `page.elements`. */
export function safePageElements(page: { elements?: unknown }): DesignElement[] {
  return Array.isArray(page.elements) ? (page.elements as DesignElement[]) : []
}
