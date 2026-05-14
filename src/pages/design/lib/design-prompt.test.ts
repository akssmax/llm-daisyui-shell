import { describe, expect, it } from "vitest"
import { buildDesignSystemPrompt, sanitizeDocumentForLlmContext } from "./design-prompt"
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
    expect(p).toContain('"id":"doc123456"')
    expect(p).toContain("ALWAYS respond with ONLY a valid JSON object")
  })

  it("uses placeholder when document is null", () => {
    expect(buildDesignSystemPrompt(null)).toContain("No document yet")
  })

  it("strips image data URLs from LLM context", () => {
    const huge = "data:image/png;base64," + "A".repeat(20_000)
    const withImage: DesignDocument = {
      ...doc,
      pages: [
        {
          id: "pg000001",
          width: 100,
          height: 100,
          backgroundColor: "#fff",
          elements: [
            {
              kind: "image",
              id: "im000001",
              x: 0,
              y: 0,
              width: 50,
              height: 50,
              rotation: 0,
              zIndex: 1,
              opacity: 1,
              src: huge,
              objectFit: "cover",
            },
          ],
        },
      ],
    }
    const sanitized = sanitizeDocumentForLlmContext(withImage)
    const img = sanitized.pages[0]?.elements[0]
    expect(img?.kind === "image" && img.src.startsWith("[data URL omitted")).toBe(true)
    expect(JSON.stringify(sanitized).length).toBeLessThan(huge.length)
  })
})
