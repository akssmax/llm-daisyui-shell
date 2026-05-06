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

export function MarkdownRenderer({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  const components = {
    callout: markdownComponentRegistry.Callout,
    kpicard: markdownComponentRegistry.KpiCard,
    a: (props: React.ComponentProps<"a">) => (
      <a {...props} target="_blank" rel="noreferrer" />
    ),
  } as unknown as Components

  return (
    <div
      className={cn(
        "prose prose-zinc max-w-none dark:prose-invert",
        "prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-muted/40",
        "prose-code:rounded prose-code:bg-muted/40 prose-code:px-1 prose-code:py-0.5",
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
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

