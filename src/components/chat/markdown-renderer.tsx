import { isValidElement, memo, useMemo, type ComponentProps, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { cn } from "@/lib/utils"
import { markdownComponentRegistry } from "@/components/chat/custom-markdown-components"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ai-elements/code-block"
import type { BundledLanguage } from "shiki"

import "katex/dist/katex.min.css"

type SanitizeSchema = typeof defaultSchema

const LANGUAGE_MAP: Record<string, BundledLanguage> = {
  bash: "bash",
  css: "css",
  html: "html",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  python: "python",
  py: "python",
  shell: "shellscript",
  sh: "shellscript",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
}

function extractTextContent(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractTextContent).join("")
  if (isValidElement(node)) return extractTextContent((node.props as { children?: ReactNode }).children)
  return ""
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "callout",
    "kpicard",
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    callout: ["tone", "title"],
    kpicard: ["label", "value"],
    a: [...(((defaultSchema.attributes as SanitizeSchema["attributes"])?.a as string[]) ?? []), "target", "rel"],
    code: [...(((defaultSchema.attributes as SanitizeSchema["attributes"])?.code as string[]) ?? []), "className"],
    span: [...(((defaultSchema.attributes as SanitizeSchema["attributes"])?.span as string[]) ?? []), "className"],
  },
} satisfies SanitizeSchema

const MARKDOWN_COMPONENTS = {
  callout: markdownComponentRegistry.Callout,
  kpicard: markdownComponentRegistry.KpiCard,
  a: (props: ComponentProps<"a">) => <a {...props} target="_blank" rel="noreferrer" />,
  pre: ({ children }: ComponentProps<"pre">) => <>{children}</>,
  code: ({
    inline,
    className,
    children,
    ...props
  }: ComponentProps<"code"> & { inline?: boolean }) => {
    const raw = extractTextContent(children)
    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }

    const languageMatch = /language-([\w-]+)/.exec(className ?? "")
    const languageLabel = languageMatch?.[1] ?? "code"
    const bundledLanguage = LANGUAGE_MAP[languageLabel.toLowerCase()] ?? "markdown"
    const code = raw.replace(/\n$/, "")

    return (
      <CodeBlock code={code} language={bundledLanguage} className="my-4">
        <CodeBlockHeader>
          <CodeBlockTitle>{languageLabel}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton aria-label="Copy code block" />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    )
  },
} as unknown as Components

function normalizeMarkdown(markdown: string): string {
  let output = markdown.replaceAll("\r\n", "\n")

  // Streaming responses sometimes send escaped newlines while the block is incomplete.
  // Convert only when the text has almost no actual line-breaks to avoid corrupting real content.
  const hasRealNewline = output.includes("\n")
  if (!hasRealNewline && output.includes("\\n")) {
    output = output.replaceAll("\\n", "\n")
  }

  // If a streaming response leaves an unmatched fence open, markdown parsers treat the rest
  // (including tables) as code. Closing it defensively restores normal rendering.
  const fenceCount = (output.match(/```/g) ?? []).length
  if (fenceCount % 2 !== 0) {
    output = `${output}\n\`\`\``
  }

  return output
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  const normalizedMarkdown = useMemo(() => normalizeMarkdown(markdown), [markdown])

  return (
    <div
      className={cn(
        "chat-markdown prose prose-zinc dark:prose-invert",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypeKatex,
          rehypeHighlight,
        ]}
        // Safe custom component map (whitelisted only)
        components={MARKDOWN_COMPONENTS}
      >
        {normalizedMarkdown}
      </ReactMarkdown>
    </div>
  )
})
