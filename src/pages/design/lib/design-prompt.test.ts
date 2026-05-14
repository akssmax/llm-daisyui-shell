import { describe, expect, it } from "vitest"
import { buildDesignSystemPrompt } from "./design-prompt"
import type { DesignDocument } from "../types"

const doc: DesignDocument = {
  id: "doc123456",
  title: "X",
  type: "slide",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  theme: {
    primaryColor: "#000",
    secondaryColor: "#111",
    accentColor: "#222",
    backgroundColor: "#fff",
    fontFamily: "Inter",
  },
  pages: [],
}

describe("buildDesignSystemPrompt", () => {
  it("embeds JSON document when provided", () => {
    const p = buildDesignSystemPrompt(doc)
    expect(p).toContain('"id": "doc123456"')
    expect(p).toContain("ALWAYS respond with ONLY a valid JSON object")
  })

  it("uses placeholder when document is null", () => {
    expect(buildDesignSystemPrompt(null)).toContain("No document yet")
  })
})
