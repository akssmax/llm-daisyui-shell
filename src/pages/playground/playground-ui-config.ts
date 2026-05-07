import type { CodeBlockShikiThemes } from "@/components/ai-elements/code-block"
import type { AgentAvatarShape } from "@/components/chat/agent-shape-avatar"
export type { AgentAvatarShape }

export type PlaygroundMaxWidth = "full" | "default" | "narrow"

export type PlaygroundThoughtLabelVariant = "thinking" | "thought-duration"

export type PlaygroundCodeThemePreset =
  | "github"
  | "nord"
  | "monokai"
  | "min"
  | "one-dark-pro"

export type PlaygroundViewport = "desktop" | "tablet" | "mobile"

export type PlaygroundUiConfig = {
  thread: {
    welcome: boolean
    scrollToBottom: boolean
    maxWidth: PlaygroundMaxWidth
  }
  composer: {
    attachments: boolean
    useCustomBackground: boolean
    backgroundColor: string
  }
  content: {
    markdown: boolean
    codeTheme: PlaygroundCodeThemePreset
    reasoning: boolean
    sources: boolean
    suggestions: boolean
  }
  avatars: {
    show: boolean
  }
  thoughtLabel: {
    variant: PlaygroundThoughtLabelVariant
    text: string
    durationSeconds: number
  }
  actions: {
    copy: boolean
    feedback: boolean
    sourcesButton: boolean
  }
  colors: {
    userBubble: string
    assistantBubble: string
    botAvatarFill: string
  }
  agentAvatar: {
    shape: AgentAvatarShape
    fill: string
  }
  previewViewport: PlaygroundViewport
}

export const PLAYGROUND_CODE_THEME_PRESETS: Record<
  PlaygroundCodeThemePreset,
  CodeBlockShikiThemes
> = {
  github: { light: "github-light", dark: "github-dark" },
  nord: { light: "nord", dark: "nord" },
  monokai: { light: "monokai", dark: "monokai" },
  min: { light: "min-light", dark: "min-dark" },
  "one-dark-pro": { light: "one-light", dark: "one-dark-pro" },
}

export function getPlaygroundShikiThemes(
  preset: PlaygroundCodeThemePreset
): CodeBlockShikiThemes {
  return PLAYGROUND_CODE_THEME_PRESETS[preset]
}

export const DEFAULT_PLAYGROUND_UI_CONFIG: PlaygroundUiConfig = {
  thread: {
    welcome: false,
    scrollToBottom: true,
    maxWidth: "default",
  },
  composer: {
    attachments: true,
    useCustomBackground: true,
    backgroundColor: "#ffffff",
  },
  content: {
    markdown: true,
    codeTheme: "github",
    reasoning: true,
    sources: true,
    suggestions: true,
  },
  avatars: {
    show: false,
  },
  thoughtLabel: {
    variant: "thinking",
    text: "Thinking...",
    durationSeconds: 4,
  },
  actions: {
    copy: true,
    feedback: true,
    sourcesButton: true,
  },
  colors: {
    userBubble: "var(--color-primary)",
    assistantBubble: "#f4f4f5",
    botAvatarFill: "var(--color-primary)",
  },
  agentAvatar: {
    shape: "Circle",
    fill: "var(--color-primary)",
  },
  previewViewport: "desktop",
}

export const PLAYGROUND_MAX_WIDTH_CLASS: Record<PlaygroundMaxWidth, string> = {
  full: "max-w-full",
  default: "max-w-[768px]",
  narrow: "max-w-md",
}

export const PLAYGROUND_VIEWPORT_CLASS: Record<PlaygroundViewport, string> = {
  desktop: "w-full max-w-full",
  tablet: "w-full max-w-[768px] shadow-sm",
  mobile: "w-full max-w-[390px] shadow-md",
}
