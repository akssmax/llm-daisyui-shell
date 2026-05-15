import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import type {
  AgentAvatarShape,
  PlaygroundCodeThemePreset,
  PlaygroundMaxWidth,
  PlaygroundThoughtLabelVariant,
  PlaygroundUiConfig,
  PlaygroundViewport,
} from "@/pages/playground/playground-ui-config"
import { AGENT_AVATAR_SHAPES } from "@/components/chat/agent-shape-avatar"

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-1 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function Row({
  label,
  children,
  indent,
}: {
  label: string
  children: ReactNode
  indent?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2.5 pr-1 pl-1",
        indent && "pl-4"
      )}
    >
      <Label className="text-sm font-normal text-foreground">{label}</Label>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ColorSwatch({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const tokenOptions: Array<{ label: string; value: string; swatchClass: string }> = [
    { label: "Base 100", value: "var(--color-base-100)", swatchClass: "bg-base-100" },
    { label: "Base 200", value: "var(--color-base-200)", swatchClass: "bg-base-200" },
    { label: "Base 300", value: "var(--color-base-300)", swatchClass: "bg-base-300" },
    { label: "Primary", value: "var(--color-primary)", swatchClass: "bg-primary" },
    { label: "Secondary", value: "var(--color-secondary)", swatchClass: "bg-secondary" },
    { label: "Accent", value: "var(--color-accent)", swatchClass: "bg-accent" },
    { label: "Neutral", value: "var(--color-neutral)", swatchClass: "bg-neutral" },
    { label: "Info", value: "var(--color-info)", swatchClass: "bg-info" },
    { label: "Success", value: "var(--color-success)", swatchClass: "bg-success" },
    { label: "Warning", value: "var(--color-warning)", swatchClass: "bg-warning" },
    { label: "Error", value: "var(--color-error)", swatchClass: "bg-error" },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Pick token color"
          className={cn(
            "size-8 rounded-full border border-border p-0.5 transition-transform",
            !disabled && "cursor-pointer hover:scale-105",
            disabled && "cursor-not-allowed opacity-40"
          )}
        >
          <span
            className="block size-full rounded-full border border-black/10"
            style={{ backgroundColor: value }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-2">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Theme tokens</div>
        <div className="grid grid-cols-6 gap-2">
          {tokenOptions.map((token) => {
            const isActive = value === token.value
            return (
              <button
                key={token.value}
                type="button"
                title={token.label}
                aria-label={`Set ${token.label}`}
                onClick={() => {
                  onChange(token.value)
                  setOpen(false)
                }}
                className={cn(
                  "size-7 rounded-full border border-border transition-transform",
                  token.swatchClass,
                  isActive && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  "cursor-pointer hover:scale-105"
                )}
              />
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function PlaygroundSettingsPanel({
  config,
  setConfig,
  className,
}: {
  config: PlaygroundUiConfig
  setConfig: Dispatch<SetStateAction<PlaygroundUiConfig>>
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col border-r border-border bg-sidebar/30", className)}>
      <div className="border-b border-border px-3 py-3">
        <p className="text-sm font-semibold text-foreground">Playground</p>
        <p className="text-xs text-muted-foreground">Customize how chat responses look.</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-2 py-3 pr-3">
          <section>
            <SectionLabel>Preview</SectionLabel>
            <Row label="Viewport">
              <Tabs
                value={config.previewViewport}
                onValueChange={(v) => setConfig((c) => ({ ...c, previewViewport: v as PlaygroundViewport }))}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="desktop" className="px-2 text-xs">
                    Desktop
                  </TabsTrigger>
                  <TabsTrigger value="tablet" className="px-2 text-xs">
                    Tablet
                  </TabsTrigger>
                  <TabsTrigger value="mobile" className="px-2 text-xs">
                    Mobile
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Row>
          </section>

          <Separator />

          <section>
            <SectionLabel>Thread</SectionLabel>
            <Row label="Welcome">
              <Switch
                checked={config.thread.welcome}
                onCheckedChange={(welcome) =>
                  setConfig((c) => ({ ...c, thread: { ...c.thread, welcome } }))
                }
              />
            </Row>
            <Row label="Scroll to bottom">
              <Switch
                checked={config.thread.scrollToBottom}
                onCheckedChange={(scrollToBottom) =>
                  setConfig((c) => ({ ...c, thread: { ...c.thread, scrollToBottom } }))
                }
              />
            </Row>
            <Row label="Max width">
              <Select
                value={config.thread.maxWidth}
                onValueChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    thread: { ...c.thread, maxWidth: v as PlaygroundMaxWidth },
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-[128px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="narrow">Narrow</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </section>

          <Separator />

          <section>
            <SectionLabel>Composer</SectionLabel>
            <Row label="Attachments">
              <Switch
                checked={config.composer.attachments}
                onCheckedChange={(attachments) =>
                  setConfig((c) => ({ ...c, composer: { ...c.composer, attachments } }))
                }
              />
            </Row>
            <Row label="Custom background">
              <Switch
                checked={config.composer.useCustomBackground}
                onCheckedChange={(useCustomBackground) =>
                  setConfig((c) => ({
                    ...c,
                    composer: { ...c.composer, useCustomBackground },
                  }))
                }
              />
            </Row>
            <Row label="Background" indent>
              <ColorSwatch
                value={config.composer.backgroundColor}
                disabled={!config.composer.useCustomBackground}
                onChange={(backgroundColor) =>
                  setConfig((c) => ({ ...c, composer: { ...c.composer, backgroundColor } }))
                }
              />
            </Row>
          </section>

          <Separator />

          <section>
            <SectionLabel>Content</SectionLabel>
            <Row label="Markdown">
              <Switch
                checked={config.content.markdown}
                onCheckedChange={(markdown) =>
                  setConfig((c) => ({ ...c, content: { ...c.content, markdown } }))
                }
              />
            </Row>
            <Row label="Code theme" indent>
              <Select
                value={config.content.codeTheme}
                onValueChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    content: { ...c.content, codeTheme: v as PlaygroundCodeThemePreset },
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-[140px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="nord">Nord</SelectItem>
                  <SelectItem value="monokai">Monokai</SelectItem>
                  <SelectItem value="min">Min</SelectItem>
                  <SelectItem value="one-dark-pro">One Dark Pro</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Reasoning">
              <Switch
                checked={config.content.reasoning}
                onCheckedChange={(reasoning) =>
                  setConfig((c) => ({ ...c, content: { ...c.content, reasoning } }))
                }
              />
            </Row>
            <Row label="Sources">
              <Switch
                checked={config.content.sources}
                onCheckedChange={(sources) =>
                  setConfig((c) => ({ ...c, content: { ...c.content, sources } }))
                }
              />
            </Row>
            <Row label="Suggestions">
              <Switch
                checked={config.content.suggestions}
                onCheckedChange={(suggestions) =>
                  setConfig((c) => ({ ...c, content: { ...c.content, suggestions } }))
                }
              />
            </Row>
          </section>

          <Separator />

          <section>
            <SectionLabel>Avatars</SectionLabel>
            <Row label="Show avatars">
              <Switch
                checked={config.avatars.show}
                onCheckedChange={(show) =>
                  setConfig((c) => ({ ...c, avatars: { ...c.avatars, show } }))
                }
              />
            </Row>
            <Row label="User bubble" indent>
              <ColorSwatch
                value={config.colors.userBubble}
                onChange={(userBubble) =>
                  setConfig((c) => ({ ...c, colors: { ...c.colors, userBubble } }))
                }
              />
            </Row>
            <Row label="LLM Response block" indent>
              <ColorSwatch
                value={config.colors.assistantBubble}
                onChange={(assistantBubble) =>
                  setConfig((c) => ({ ...c, colors: { ...c.colors, assistantBubble } }))
                }
              />
            </Row>
          </section>

          <Separator />

          <section>
            <SectionLabel>Agent avatar</SectionLabel>
            <Row label="Shape">
              <Select
                value={config.agentAvatar.shape}
                onValueChange={(value) =>
                  setConfig((c) => ({
                    ...c,
                    agentAvatar: { ...c.agentAvatar, shape: value as AgentAvatarShape },
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-[170px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_AVATAR_SHAPES.map((shape) => (
                    <SelectItem key={shape} value={shape}>
                      {shape}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Fill">
              <ColorSwatch
                value={config.agentAvatar.fill}
                onChange={(fill) =>
                  setConfig((c) => ({
                    ...c,
                    agentAvatar: { ...c.agentAvatar, fill },
                    colors: { ...c.colors, botAvatarFill: fill },
                  }))
                }
              />
            </Row>
          </section>

          <Separator />

          <section>
            <SectionLabel>Chain of thought</SectionLabel>
            <Row label="Thought label style">
              <Select
                value={config.thoughtLabel.variant}
                onValueChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    thoughtLabel: {
                      ...c.thoughtLabel,
                      variant: v as PlaygroundThoughtLabelVariant,
                    },
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-[128px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thinking">Thinking</SelectItem>
                  <SelectItem value="thought-duration">Thought duration</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Thought label text">
              <Input
                className="h-8 w-[140px] rounded-lg text-xs"
                value={config.thoughtLabel.text}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    thoughtLabel: { ...c.thoughtLabel, text: e.target.value },
                  }))
                }
              />
            </Row>
            {config.thoughtLabel.variant === "thought-duration" ? (
              <Row label="Duration (sec)">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  className="h-8 w-[140px] rounded-lg text-xs"
                  value={String(config.thoughtLabel.durationSeconds)}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value || "0", 10)
                    setConfig((c) => ({
                      ...c,
                      thoughtLabel: {
                        ...c.thoughtLabel,
                        durationSeconds: Number.isFinite(next) && next > 0 ? next : 1,
                      },
                    }))
                  }}
                />
              </Row>
            ) : null}
          </section>

          <Separator />

          <section>
            <SectionLabel>Actions</SectionLabel>
            <Row label="Copy">
              <Switch
                checked={config.actions.copy}
                onCheckedChange={(copy) =>
                  setConfig((c) => ({ ...c, actions: { ...c.actions, copy } }))
                }
              />
            </Row>
            <Row label="Feedback">
              <Switch
                checked={config.actions.feedback}
                onCheckedChange={(feedback) =>
                  setConfig((c) => ({ ...c, actions: { ...c.actions, feedback } }))
                }
              />
            </Row>
            <Row label="Sources button">
              <Switch
                checked={config.actions.sourcesButton}
                onCheckedChange={(sourcesButton) =>
                  setConfig((c) => ({ ...c, actions: { ...c.actions, sourcesButton } }))
                }
              />
            </Row>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
