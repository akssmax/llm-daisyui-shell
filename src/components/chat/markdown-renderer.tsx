import { memo, useMemo, type ComponentProps } from "react"
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

import "katex/dist/katex.min.css"

type SanitizeSchema = typeof defaultSchema

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
