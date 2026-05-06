import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FileText,
  FolderKanban,
  Globe,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Table2,
  Workflow,
  Zap,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AIElementsChatShell } from "@/components/chat/ai-elements-chat-shell"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  createChatThread,
  loadChatThreads,
  saveChatThreads,
  type ChatThread,
  updateChatThread,
} from "@/lib/chat-threads"
import { getThreadIdFromUrl, onThreadUrlChange, setThreadIdInUrl } from "@/lib/thread-url"

type PageKey = "new-chat" | "sites" | "smart-tables" | "page-boosts" | "routines"
type IconType = React.ComponentType<{ className?: string }>

const workspaceItems: Array<{ label: string; key: PageKey; icon: IconType }> = [
  { label: "New Chat", key: "new-chat", icon: MessageSquarePlus },
  { label: "Sites", key: "sites", icon: Globe },
  { label: "Smart Tables", key: "smart-tables", icon: Table2 },
  { label: "Page Boosts", key: "page-boosts", icon: Zap },
  { label: "Routines", key: "routines", icon: Workflow },
]

function SidebarCollapseButton() {
  const { state, toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon-sm"
      className="hidden md:inline-flex group-data-[collapsible=icon]:hidden"
      onClick={toggleSidebar}
    >
      {state === "collapsed" ? (
        <PanelLeftOpen className="size-4" />
      ) : (
        <PanelLeftClose className="size-4" />
      )}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarBrand() {
  const { state, toggleSidebar } = useSidebar()

  return (
    <div className="flex items-center gap-2">
      <div
        className="group/brand grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"
        onClick={() => {
          if (state === "collapsed") toggleSidebar()
        }}
      >
        <MessageSquarePlus className="size-4 transition-opacity group-data-[collapsible=icon]:group-hover/brand:opacity-0" />
        <PanelLeftOpen className="absolute size-4 opacity-0 transition-opacity group-data-[collapsible=icon]:group-hover/brand:opacity-100" />
      </div>
      <div className="group-data-[collapsible=icon]:hidden">
        <p className="text-sm font-semibold text-sidebar-foreground">100x</p>
        <p className="text-xs text-sidebar-foreground/70">Chat shell</p>
      </div>
    </div>
  )
}

function MetricsRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((metric) => (
        <Card key={metric.label} size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="text-lg font-semibold text-foreground">{metric.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SitesPage() {
  return (
    <div className="space-y-4">
      <MetricsRow
        items={[
          { label: "Active domains", value: "24" },
          { label: "Healthy", value: "19" },
          { label: "Needs fixes", value: "5" },
          { label: "Avg score", value: "86" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Connected Sites</CardTitle>
          <CardDescription>Monitor crawl and publish status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["acme.com", "Healthy", "342", "2m ago"],
                ["scalex.io", "Syncing", "119", "8m ago"],
                ["zenpay.app", "Warning", "88", "18m ago"],
              ].map((row) => (
                <TableRow key={row[0]}>
                  <TableCell className="font-medium">{row[0]}</TableCell>
                  <TableCell>{row[1]}</TableCell>
                  <TableCell>{row[2]}</TableCell>
                  <TableCell>{row[3]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SmartTablesPage() {
  return (
    <div className="space-y-4">
      <MetricsRow
        items={[
          { label: "Tables", value: "12" },
          { label: "Rows", value: "24.2k" },
          { label: "Views", value: "33" },
          { label: "Automations", value: "9" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Smart Tables</CardTitle>
          <CardDescription>Track key data sets with consistent schema.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Last run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Frontend Engineer - Feb", "2,436", "Recruiting", "1m ago"],
                ["Outbound Campaigns", "1,008", "Growth", "5m ago"],
                ["Customer Support QA", "7,980", "Ops", "12m ago"],
              ].map((row) => (
                <TableRow key={row[0]}>
                  <TableCell className="font-medium">{row[0]}</TableCell>
                  <TableCell>{row[1]}</TableCell>
                  <TableCell>{row[2]}</TableCell>
                  <TableCell>{row[3]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function PageBoostsPage() {
  return (
    <div className="space-y-4">
      <MetricsRow
        items={[
          { label: "Boosts live", value: "7" },
          { label: "Impressions", value: "142k" },
          { label: "Clicks", value: "8.2k" },
          { label: "CTR", value: "5.8%" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Page Boost Campaigns</CardTitle>
          <CardDescription>Prioritize high-impact pages and segments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ["/pricing", "High intent users", "Running"],
            ["/integrations", "Activation cohort", "Draft"],
            ["/careers", "Talent funnel", "Running"],
          ].map((row) => (
            <div
              key={row[0]}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{row[0]}</p>
                <p className="text-xs text-muted-foreground">{row[1]}</p>
              </div>
              <Badge variant={row[2] === "Running" ? "default" : "secondary"}>{row[2]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function RoutinesPage() {
  return (
    <div className="space-y-4">
      <MetricsRow
        items={[
          { label: "Routines", value: "18" },
          { label: "Scheduled", value: "11" },
          { label: "Failed", value: "2" },
          { label: "Success rate", value: "96%" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Automation Routines</CardTitle>
          <CardDescription>Reliable workflows for recurring operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ["Candidate outreach sync", "Every 15 mins", "Healthy"],
            ["Knowledge base refresh", "Daily 02:00", "Healthy"],
            ["Priority issue triage", "Hourly", "Attention"],
          ].map((row) => (
            <div
              key={row[0]}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{row[0]}</p>
                <p className="text-xs text-muted-foreground">{row[1]}</p>
              </div>
              <Badge variant={row[2] === "Healthy" ? "secondary" : "destructive"}>{row[2]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ChatPage({
  thread,
  onUpdateThread,
}: {
  thread: ChatThread
  onUpdateThread: (threadId: string, updater: (thread: ChatThread) => ChatThread) => void
}) {
  return <AIElementsChatShell thread={thread} onUpdateThread={onUpdateThread} />
}

function StandardPageShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: IconType
  children: React.ReactNode
}) {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center rounded-md bg-accent p-1.5 text-accent-foreground">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input className="hidden w-56 md:block" placeholder="Search" />
          <Button size="sm">Create</Button>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-4">{children}</div>
      </ScrollArea>
    </>
  )
}

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("new-chat")
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const ensureActiveThreadFromUrl = useCallback(
    (currentThreads: ChatThread[]) => {
      let nextThreads = currentThreads
      const requestedThreadId = getThreadIdFromUrl()
      let activeThread =
        (requestedThreadId
          ? nextThreads.find((thread) => thread.threadId === requestedThreadId)
          : null) ?? nextThreads[0]

      if (!activeThread) {
        activeThread = createChatThread()
        nextThreads = [activeThread]
      }

      if (requestedThreadId !== activeThread.threadId) {
        setThreadIdInUrl(activeThread.threadId, { replace: true })
      }

      setThreads(nextThreads)
      setActiveThreadId(activeThread.threadId)
    },
    []
  )

  useEffect(() => {
    const loadedThreads = loadChatThreads()
    ensureActiveThreadFromUrl(loadedThreads)
  }, [ensureActiveThreadFromUrl])

  useEffect(() => {
    saveChatThreads(threads)
  }, [threads])

  useEffect(() => {
    return onThreadUrlChange(() => {
      const requestedThreadId = getThreadIdFromUrl()
      if (!requestedThreadId) {
        ensureActiveThreadFromUrl(threads)
        return
      }
      const existing = threads.find((thread) => thread.threadId === requestedThreadId)
      if (!existing) {
        ensureActiveThreadFromUrl(threads)
        return
      }
      setActivePage("new-chat")
      setActiveThreadId(existing.threadId)
    })
  }, [ensureActiveThreadFromUrl, threads])

  const activeThread = useMemo(
    () => threads.find((thread) => thread.threadId === activeThreadId) ?? null,
    [activeThreadId, threads]
  )

  const createAndSelectThread = useCallback(() => {
    const newThread = createChatThread()
    setThreads((prev) => [newThread, ...prev])
    setActiveThreadId(newThread.threadId)
    setThreadIdInUrl(newThread.threadId)
    setActivePage("new-chat")
  }, [])

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    setThreadIdInUrl(threadId)
    setActivePage("new-chat")
  }, [])

  const handleUpdateThread = useCallback(
    (threadId: string, updater: (thread: ChatThread) => ChatThread) => {
      setThreads((prev) => updateChatThread(prev, threadId, updater))
    },
    []
  )

  const currentLabel = useMemo(
    () => workspaceItems.find((item) => item.key === activePage)?.label ?? "New Chat",
    [activePage]
  )

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <div className="flex h-14 items-center justify-between px-2">
          <SidebarBrand />
          <div className="flex items-center gap-1">
            <SidebarCollapseButton />
            <SidebarTrigger className="md:hidden" />
          </div>
        </div>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={item.key === activePage && (item.key !== "new-chat" || Boolean(activeThread))}
                      tooltip={item.label}
                      onClick={() => {
                        if (item.key === "new-chat") {
                          createAndSelectThread()
                          return
                        }
                        setActivePage(item.key)
                      }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Recents</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {threads.map((thread) => (
                  <SidebarMenuItem key={thread.threadId}>
                    <SidebarMenuButton
                      isActive={activePage === "new-chat" && activeThreadId === thread.threadId}
                      tooltip={thread.title}
                      onClick={() => selectThread(thread.threadId)}
                    >
                      <FolderKanban />
                      <span>{thread.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Files">
                    <FileText />
                    <span>Files</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
          <ThemeSwitcher />
          <div className="flex items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/60 p-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            <div className="flex items-center gap-2">
              <Avatar className="size-8 border border-sidebar-border">
                <AvatarFallback className="bg-primary/15 text-xs text-sidebar-foreground">AS</AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-medium text-sidebar-foreground">Akshay Saini</p>
                <p className="text-[11px] text-sidebar-foreground/70">akshaysaini.design@gmail.com</p>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="h-svh overflow-hidden">
        <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
          {activePage === "new-chat" && activeThread ? (
            <ChatPage thread={activeThread} onUpdateThread={handleUpdateThread} />
          ) : null}
          {activePage === "sites" && (
            <StandardPageShell
              title={currentLabel}
              description="Connect and monitor external properties"
              icon={Globe}
            >
              <SitesPage />
            </StandardPageShell>
          )}
          {activePage === "smart-tables" && (
            <StandardPageShell
              title={currentLabel}
              description="Structured data views and operations"
              icon={Table2}
            >
              <SmartTablesPage />
            </StandardPageShell>
          )}
          {activePage === "page-boosts" && (
            <StandardPageShell
              title={currentLabel}
              description="Campaign performance and optimization"
              icon={Zap}
            >
              <PageBoostsPage />
            </StandardPageShell>
          )}
          {activePage === "routines" && (
            <StandardPageShell
              title={currentLabel}
              description="Automation health and schedules"
              icon={Workflow}
            >
              <RoutinesPage />
            </StandardPageShell>
          )}
        </main>
      </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ErrorBoundary>
  )
}

export default App
