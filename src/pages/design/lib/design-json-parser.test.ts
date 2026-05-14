import { describe, expect, it } from "vitest"
import { extractJsonFromStream } from "./design-json-parser"
import type { DesignDocument } from "../types"

const minimalDoc: DesignDocument = {
  id: "doc123456",
  title: "Test",
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
  pages: [
    {
      id: "page1",
      width: 1080,
      height: 1080,
      backgroundColor: "#FFFFFF",
      elements: [],
    },
  ],
}

describe("extractJsonFromStream", () => {
  it("parses wrapped document JSON", () => {
    const raw = JSON.stringify({ kind: "document", document: minimalDoc })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
    if (r.kind === "document") expect(r.document.id).toBe("doc123456")
  })

  it("parses assistantNote on document response", () => {
    const raw = JSON.stringify({
      kind: "document",
      document: minimalDoc,
      assistantNote: "Built a hero layout. Try stronger CTA contrast and a second slide for features.",
    })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
    if (r.kind === "document") {
      expect(r.assistantNote).toContain("hero")
      expect(r.document.title).toBe("Test")
    }
  })

  it("parses document from prose-prefixed stream", () => {
    const inner = JSON.stringify({ kind: "document", document: minimalDoc })
    const raw = `Here is the design:\n${inner}\nThanks.`
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
  })

  it("parses patches", () => {
    const raw = JSON.stringify({
      kind: "patches",
      patches: [{ op: "delete_element", pageId: "page1", elementId: "x" }],
    })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("patches")
    if (r.kind === "patches") expect(r.patches).toHaveLength(1)
  })

  it("parses message kind", () => {
    const raw = JSON.stringify({ kind: "message", text: "hello" })
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "hello" })
  })

  it("accepts bare document object (no wrapper)", () => {
    const raw = JSON.stringify(minimalDoc)
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
  })

  it("returns message on invalid JSON", () => {
    const r = extractJsonFromStream("not json")
    expect(r.kind).toBe("message")
    if (r.kind === "message") expect(r.text).toContain("Could not read")
  })

  it("parses JSON wrapped in markdown code fences", () => {
    const inner = JSON.stringify({ kind: "message", text: "ok" })
    const raw = "```json\n" + inner + "\n```"
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "ok" })
  })

  it("strips thinking tags before JSON", () => {
    const inner = JSON.stringify({ kind: "message", text: "hi" })
    const raw = "<thinking>plan…</thinking>" + inner
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "hi" })
  })

  it("prefers the last markdown fence when multiple exist", () => {
    const bad = JSON.stringify({ kind: "message", text: "draft" })
    const good = JSON.stringify({ kind: "message", text: "final" })
    const raw = `Thoughts:\n\`\`\`json\n${bad}\n\`\`\`\n\nAnswer:\n\`\`\`json\n${good}\n\`\`\``
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "final" })
  })

  it("parses JSON when prose precedes a fenced block", () => {
    const inner = JSON.stringify({ kind: "message", text: "y" })
    const raw = `I'll output JSON now:\n\`\`\`json\n${inner}\n\`\`\`\nDone.`
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "y" })
  })

  it("parses design JSON after prose when the payload has } inside string values", () => {
    const inner = JSON.stringify({ kind: "message", text: "Use } and { in copy", assistantNote: "ok }" })
    const raw = `Here is the answer:\n${inner}`
    expect(extractJsonFromStream(raw)).toEqual({
      kind: "message",
      text: "Use } and { in copy",
      assistantNote: "ok }",
    })
  })

  it("prefers the last root-level JSON object when earlier JSON is not a design reply", () => {
    const good = JSON.stringify({ kind: "message", text: "final" })
    const raw = `{ "not": "design", "x": 1 } junk ${good}`
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "final" })
  })

  it("detects truncated JSON and returns a cut-off hint", () => {
    const raw = '{"kind":"document","document":{'
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("message")
    if (r.kind === "message") expect(r.text).toContain("cut off")
  })

  it("parses top-level patch array", () => {
    const raw = JSON.stringify([{ op: "delete_element", pageId: "page1", elementId: "x" }])
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("patches")
    if (r.kind === "patches") expect(r.patches).toHaveLength(1)
  })

  it("normalizes Kind casing to kind", () => {
    const raw = JSON.stringify({
      Kind: "patches",
      patches: [{ op: "delete_element", pageId: "page1", elementId: "x" }],
    })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("patches")
  })

  it("repairs trailing comma via jsonrepair", () => {
    const raw = '{"kind":"message","text":"hi",}'
    const r = extractJsonFromStream(raw)
    expect(r).toEqual({ kind: "message", text: "hi" })
  })

  it("unwraps { response: { kind, document } } envelope", () => {
    const inner = { kind: "document" as const, document: minimalDoc }
    const raw = JSON.stringify({ response: inner })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
    if (r.kind === "document") expect(r.document.id).toBe("doc123456")
  })

  it("parses stringified document field", () => {
    const raw = JSON.stringify({
      kind: "document",
      document: JSON.stringify(minimalDoc),
    })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
    if (r.kind === "document") expect(r.document.title).toBe("Test")
  })

  it("coerces document when theme is null (agent compose drift)", () => {
    const loose = {
      ...minimalDoc,
      theme: null,
    }
    const raw = JSON.stringify({ kind: "document", document: loose })
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
    if (r.kind === "document") {
      expect(r.document.theme.fontFamily).toBe("Inter")
      expect(r.document.pages[0].elements).toEqual([])
    }
  })

  it("parses design JSON when the model returns a JSON-encoded string", () => {
    const inner = JSON.stringify({ kind: "document", document: minimalDoc })
    const raw = JSON.stringify(inner)
    const r = extractJsonFromStream(raw)
    expect(r.kind).toBe("document")
    if (r.kind === "document") expect(r.document.id).toBe("doc123456")
  })

  it("parses JSON inside an unclosed markdown fence", () => {
    const inner = JSON.stringify({ kind: "message", text: "ok" })
    const raw = "Here:\n```json\n" + inner
    expect(extractJsonFromStream(raw)).toEqual({ kind: "message", text: "ok" })
  })
})
