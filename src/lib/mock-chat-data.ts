import type { FileUIPart, UIMessage } from "ai"

export type MockSource = { href: string; title: string }
export type MemorySourceEntry = {
  id: string
  kind: "memory" | "rag"
  title: string
  description: string
}

export type MockToolCall = {
  name: string
  description: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied"
  input?: Record<string, unknown>
  output?: unknown
  error?: string
}

export type MockAssistantMeta = {
  reasoning?: { content: string; durationSeconds?: number }
  sources?: MockSource[]
  tools?: MockToolCall[]
  confirmation?: { title: string; description?: string }
  context?: { label: string; value: string }
  citations?: Array<{ label: string; href: string }>
  attachments?: Array<FileUIPart & { id: string }>
  memorySources?: MemorySourceEntry[]
}

export type MockChatItem = {
  id: string
  message: UIMessage
  // Used by AI Elements components that are outside the raw message shape
  meta?: MockAssistantMeta
  // Multiple branches/versions per message
  branches?: Array<{ id: string; content: string }>
}

export const mockChat: MockChatItem[] = [
  {
    id: "u1",
    message: {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "Run workflow @JobDescriptionAnalyzer and summarize the data." }],
    },
  },
  {
    id: "a1",
    message: {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    },
    branches: [
      {
        id: "v1",
        content:
          [
            "# Workflow Execution: Contact Shortlisted Candidates",
            "",
            "I found **12** shortlisted candidates in the “Frontend Engineer – Feb” table.",
            "",
            "Here’s a quick breakdown:",
            "",
            "- 12 have valid email addresses",
            "- 9 are marked “Actively looking”",
            "- 3 are “Open to offers”",
            "- 2 have existing interview notes",
            "",
            "## Notes",
            "",
            "Inline math example: \\(E = mc^2\\)",
            "",
            "Block math:",
            "",
            "$$\\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\\n$$",
            "",
            "A table:",
            "",
            "| Status | Count |",
            "|---|---:|",
            "| Actively looking | 9 |",
            "| Open to offers | 3 |",
            "",
            "Code block:",
            "",
            "```ts",
            "type Candidate = { name: string; status: 'active' | 'open' }",
            "```",
            "",
            "<Callout tone=\"info\" title=\"Next step\">Open the Smart Tables tab to review candidates.</Callout>",
          ].join("\\n"),
      },
      {
        id: "v2",
        content:
          [
            "## Summary",
            "",
            "I found **12** shortlisted candidates and drafted outreach emails using their role, projects, and location preference.",
            "",
            "<KpiCard label=\"Shortlisted\" value=\"12\" />",
          ].join("\\n"),
      },
    ],
    meta: {
      sources: [
        { href: "https://react.dev/reference/react", title: "React Documentation" },
        { href: "https://elements.ai-sdk.dev/", title: "AI Elements" },
      ],
      reasoning: {
        content:
          "I need to query the table, filter candidates by status, then generate a structured summary and an email draft. I should include counts and keep the response skimmable.",
        durationSeconds: 5,
      },
      tools: [
        {
          name: "table_query",
          description: "Query Smart Tables for shortlisted candidates",
          state: "output-available",
          input: { table: "Frontend Engineer - Feb", filter: "shortlisted=true" },
          output: { shortlisted: 12, activelyLooking: 9, openToOffers: 3, interviewNotes: 2 },
        },
      ],
      confirmation: {
        title: "Send outreach emails?",
        description: "This will draft and queue messages for all 12 candidates.",
      },
      context: { label: "Workspace", value: "Recruiter Agent" },
      citations: [{ label: "Frontend Engineer – Feb table", href: "https://example.com/tables/frontend-engineer-feb" }],
    },
  },
]

