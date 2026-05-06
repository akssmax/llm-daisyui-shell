import { Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebar } from "@/components/ui/sidebar"
import { DAISY_THEMES, useTheme } from "@/components/theme-provider"

function formatThemeLabel(theme: string) {
  return theme.charAt(0).toUpperCase() + theme.slice(1)
}

function ThemeSwatch({ theme }: { theme: (typeof DAISY_THEMES)[number] }) {
  return (
    <span
      data-theme={theme}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-100 p-[2px]"
      aria-hidden
    >
      <span className="grid size-full grid-cols-2 gap-[2px]">
        <span className="rounded-[2px] bg-primary" />
        <span className="rounded-[2px] bg-secondary" />
        <span className="rounded-[2px] bg-accent" />
        <span className="rounded-[2px] bg-neutral" />
      </span>
    </span>
  )
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const { state } = useSidebar()

  const isCollapsed = state === "collapsed"
  const selectedTheme = theme === "system" ? "light" : theme

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0"
      aria-label="Switch app theme"
    >
      <Palette className="size-4 shrink-0" />
      <span className="truncate group-data-[collapsible=icon]:hidden">
        Theme: {formatThemeLabel(selectedTheme)}
      </span>
    </Button>
  )

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" hidden={!isCollapsed}>
          Switch theme
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-56 overflow-auto border border-sidebar-border bg-sidebar"
      >
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedTheme}
          onValueChange={(value) => setTheme(value as (typeof DAISY_THEMES)[number])}
        >
          {DAISY_THEMES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <ThemeSwatch theme={option} />
              <span>{formatThemeLabel(option)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
