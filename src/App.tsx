import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  Brain,
  MoreHorizontal,
  FileText,
  Database,
  MessageCircle,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  SlidersHorizontal,
  Table2,
  Trash2,
  Workflow,
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
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  buildMemoryContext,
  clearUserMemory,
  loadUserMemory,
  saveUserMemory,
  type UserMemory,
} from "@/lib/user-memory"
import {
  clearRagScope,
  deleteRagSource,
  getRagFileAcceptString,
  ingestRagFile,
  listRagSources,
  validateRagFile,
  type RagScope,
  type RagSource,
} from "@/lib/rag-memory"
import { getThreadIdFromUrl, onThreadUrlChange, setThreadIdInUrl } from "@/lib/thread-url"
import { PlaygroundPage } from "@/pages/playground/playground-page"

type PageKey =
  | "new-chat"
  | "memory"
  | "knowledge"
  | "smart-tables"
  | "routines"
  | "playground"
type IconType = React.ComponentType<{ className?: string }>

const workspaceItems: Array<{ label: string; key: PageKey; icon: IconType }> = [
  { label: "New Chat", key: "new-chat", icon: MessageSquarePlus },
  { label: "Memory", key: "memory", icon: Brain },
  { label: "Knowledge", key: "knowledge", icon: Database },
  { label: "Smart Tables", key: "smart-tables", icon: Table2 },
  { label: "Routines", key: "routines", icon: Workflow },
  { label: "Playground", key: "playground", icon: SlidersHorizontal },
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
        <Bot className="size-4 transition-opacity group-data-[collapsible=icon]:group-hover/brand:opacity-0" />
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
  globalMemory,
  onSaveGlobalMemory,
}: {
  thread: ChatThread
  onUpdateThread: (threadId: string, updater: (thread: ChatThread) => ChatThread) => void
  globalMemory: UserMemory
  onSaveGlobalMemory: (next: Partial<UserMemory>) => void
}) {
  return (
    <AIElementsChatShell
      thread={thread}
      onUpdateThread={onUpdateThread}
      globalMemory={globalMemory}
      onSaveGlobalMemory={onSaveGlobalMemory}
    />
  )
}

function MemoryPage({
  activeThread,
  onUpdateThread,
  userMemory,
  setUserMemory,
}: {
  activeThread: ChatThread | null
  onUpdateThread: (threadId: string, updater: (thread: ChatThread) => ChatThread) => void
  userMemory: UserMemory
  setUserMemory: (memory: UserMemory) => void
}) {
  const [profile, setProfile] = useState(userMemory.profile)
  const [preferences, setPreferences] = useState(userMemory.preferences)
  const [facts, setFacts] = useState(userMemory.facts)
  const [retrievalEnabled, setRetrievalEnabled] = useState(userMemory.retrievalEnabled)
  const [retrievalMode, setRetrievalMode] = useState<UserMemory["retrievalMode"]>(userMemory.retrievalMode)
  const [threadMemory, setThreadMemory] = useState(activeThread?.threadMemory ?? "")

  useEffect(() => {
    setProfile(userMemory.profile)
    setPreferences(userMemory.preferences)
    setFacts(userMemory.facts)
    setRetrievalEnabled(userMemory.retrievalEnabled)
    setRetrievalMode(userMemory.retrievalMode)
  }, [userMemory])

  useEffect(() => {
    setThreadMemory(activeThread?.threadMemory ?? "")
  }, [activeThread?.threadId, activeThread?.threadMemory])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Global Memory</CardTitle>
          <CardDescription>Used across all chat threads.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="memory-profile">Profile</Label>
            <Textarea id="memory-profile" value={profile} onChange={(e) => setProfile(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory-preferences">Preferences</Label>
            <Textarea
              id="memory-preferences"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory-facts">Facts</Label>
            <Textarea id="memory-facts" value={facts} onChange={(e) => setFacts(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const next = saveUserMemory({
                  profile,
                  preferences,
                  facts,
                  retrievalEnabled,
                  retrievalMode,
                })
                setUserMemory(next)
              }}
            >
              Save memory
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const next = clearUserMemory()
                setUserMemory(next)
              }}
            >
              Clear global memory
            </Button>
          </div>
          <div className="grid gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Prompt-based retrieval</p>
                <p className="text-xs text-muted-foreground">
                  Enable or disable memory and knowledge retrieval gate.
                </p>
              </div>
              <Switch checked={retrievalEnabled} onCheckedChange={setRetrievalEnabled} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retrieval-mode">Retrieval mode</Label>
              <Select
                value={retrievalMode}
                onValueChange={(value) => setRetrievalMode(value as UserMemory["retrievalMode"])}
                disabled={!retrievalEnabled}
              >
                <SelectTrigger id="retrieval-mode" className="h-9 w-full">
                  <SelectValue placeholder="Select retrieval mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thread Memory</CardTitle>
          <CardDescription>Only applies to the currently selected thread.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeThread ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Use memory in this chat</p>
                  <p className="text-xs text-muted-foreground">Toggle personalization for this thread.</p>
                </div>
                <Switch
                  checked={activeThread.useMemory !== false}
                  onCheckedChange={(checked) => {
                    onUpdateThread(activeThread.threadId, (current) => ({
                      ...current,
                      useMemory: checked,
                    }))
                  }}
                />
              </div>
              <Textarea value={threadMemory} onChange={(e) => setThreadMemory(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onUpdateThread(activeThread.threadId, (current) => ({
                      ...current,
                      threadMemory,
                    }))
                  }}
                >
                  Save thread memory
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onUpdateThread(activeThread.threadId, (current) => ({
                      ...current,
                      threadMemory: "",
                    }))
                  }}
                >
                  Clear thread memory
                </Button>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {buildMemoryContext(userMemory, threadMemory) || "No memory context configured yet."}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a chat thread to manage thread memory.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KnowledgePage({
  activeThread,
  sources,
  refreshSources,
}: {
  activeThread: ChatThread | null
  sources: RagSource[]
  refreshSources: () => void
}) {
  const [scope, setScope] = useState<RagScope>("global")
  const [uploadError, setUploadError] = useState("")

  const scopedSources = useMemo(() => {
    return sources.filter((source) => {
      if (source.scope === "global") return true
      return source.threadId === activeThread?.threadId
    })
  }, [activeThread?.threadId, sources])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Sources</CardTitle>
          <CardDescription>Upload .md, .txt, or .json files for retrieval memory.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="rag-scope">Scope</Label>
            <select
              id="rag-scope"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as RagScope)}
            >
              <option value="global">Global</option>
              <option value="thread" disabled={!activeThread}>
                Thread
              </option>
            </select>
          </div>
          <Input
            type="file"
            multiple
            accept={getRagFileAcceptString()}
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? [])
              setUploadError("")
              if (files.length > 50) {
                setUploadError("You can upload up to 50 files at once.")
                return
              }
              for (const file of files) {
                const validation = validateRagFile(file, 5 * 1024 * 1024)
                if (validation) {
                  setUploadError(validation)
                  return
                }
              }
              for (const file of files) {
                await ingestRagFile({
                  file,
                  scope,
                  threadId: scope === "thread" ? activeThread?.threadId : undefined,
                })
              }
              refreshSources()
            }}
          />
          {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                clearRagScope("global")
                refreshSources()
              }}
            >
              Clear global KB
            </Button>
            <Button
              variant="outline"
              disabled={!activeThread}
              onClick={() => {
                clearRagScope("thread", activeThread?.threadId)
                refreshSources()
              }}
            >
              Clear thread KB
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indexed Sources</CardTitle>
          <CardDescription>Current retrieval sources for this workspace/thread.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    <Badge variant={source.scope === "global" ? "secondary" : "outline"}>{source.scope}</Badge>
                  </TableCell>
                  <TableCell>{source.type}</TableCell>
                  <TableCell>{Math.max(1, Math.round(source.sizeBytes / 1024))} KB</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        deleteRagSource(source.id)
                        refreshSources()
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {scopedSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No knowledge sources yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
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
  const [userMemory, setUserMemory] = useState<UserMemory>(() => loadUserMemory())
  const handleSaveGlobalMemory = useCallback((nextPartial: Partial<UserMemory>) => {
    setUserMemory((current) => saveUserMemory({ ...current, ...nextPartial }))
  }, [])

  const [ragSources, setRagSources] = useState<RagSource[]>(() => listRagSources())
  const [threadToDelete, setThreadToDelete] = useState<ChatThread | null>(null)
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const threadsRef = useRef<ChatThread[]>([])

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
    threadsRef.current = threads
  }, [threads])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveChatThreads(threads)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [threads])

  useEffect(() => {
    const flushThreads = () => {
      saveChatThreads(threadsRef.current)
    }
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushThreads()
    }
    window.addEventListener("beforeunload", flushThreads)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("beforeunload", flushThreads)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  useEffect(() => {
    return onThreadUrlChange(() => {
      const requestedThreadId = getThreadIdFromUrl()
      const currentThreads = threadsRef.current
      if (!requestedThreadId) {
        ensureActiveThreadFromUrl(currentThreads)
        return
      }
      const existing = currentThreads.find((thread) => thread.threadId === requestedThreadId)
      if (!existing) {
        ensureActiveThreadFromUrl(currentThreads)
        return
      }
      setActivePage("new-chat")
      setActiveThreadId(existing.threadId)
    })
  }, [ensureActiveThreadFromUrl])

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

  const startRenameThread = useCallback((threadId: string) => {
    const current = threads.find((thread) => thread.threadId === threadId)
    if (!current) return
    setRenamingThreadId(threadId)
    setRenameDraft(current.title)
  }, [threads])

  const commitRenameThread = useCallback((threadId: string) => {
    const nextTitle = renameDraft.trim()
    if (!nextTitle) return
    setThreads((prev) =>
      updateChatThread(prev, threadId, (thread) => ({
        ...thread,
        title: nextTitle.slice(0, 64),
      }))
    )
    setRenamingThreadId(null)
    setRenameDraft("")
  }, [renameDraft])

  const cancelRenameThread = useCallback(() => {
    setRenamingThreadId(null)
    setRenameDraft("")
  }, [])

  const deleteThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      const remaining = prev.filter((thread) => thread.threadId !== threadId)
      if (remaining.length === 0) {
        const fallback = createChatThread()
        setActiveThreadId(fallback.threadId)
        setThreadIdInUrl(fallback.threadId, { replace: true })
        setActivePage("new-chat")
        return [fallback]
      }
      if (activeThreadId === threadId) {
        const fallback = remaining[0]
        if (fallback) {
          setActiveThreadId(fallback.threadId)
          setThreadIdInUrl(fallback.threadId, { replace: true })
          setActivePage("new-chat")
        }
      }
      return remaining
    })
  }, [activeThreadId])

  const currentLabel = useMemo(
    () => workspaceItems.find((item) => item.key === activePage)?.label ?? "New Chat",
    [activePage]
  )
  const refreshRagSources = useCallback(() => {
    setRagSources(listRagSources())
  }, [])

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
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
                      isActive={
                        item.key === activePage &&
                        (item.key !== "new-chat" || Boolean(activeThread))
                      }
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
                  <SidebarMenuItem key={thread.threadId} className="group/menu-item relative">
                    <SidebarMenuButton
                      isActive={activePage === "new-chat" && activeThreadId === thread.threadId}
                      tooltip={thread.title}
                      onClick={() => {
                        if (renamingThreadId === thread.threadId) return
                        selectThread(thread.threadId)
                      }}
                      className="pr-9"
                    >
                      <MessageCircle />
                      {renamingThreadId === thread.threadId ? (
                        <Input
                          autoFocus
                          className="h-6 px-2 text-xs"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => commitRenameThread(thread.threadId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              commitRenameThread(thread.threadId)
                            } else if (event.key === "Escape") {
                              event.preventDefault()
                              cancelRenameThread()
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <span>{thread.title}</span>
                      )}
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover/menu-item:opacity-100 data-[state=open]:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Chat actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => startRenameThread(thread.threadId)}>
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setThreadToDelete(thread)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <ChatPage
              thread={activeThread}
              onUpdateThread={handleUpdateThread}
              globalMemory={userMemory}
              onSaveGlobalMemory={handleSaveGlobalMemory}
            />
          ) : null}
          {activePage === "memory" && (
            <StandardPageShell
              title={currentLabel}
              description="Persistent user and thread memory"
              icon={Brain}
            >
              <MemoryPage
                activeThread={activeThread}
                onUpdateThread={handleUpdateThread}
                userMemory={userMemory}
                setUserMemory={setUserMemory}
              />
            </StandardPageShell>
          )}
          {activePage === "knowledge" && (
            <StandardPageShell
              title={currentLabel}
              description="Manage retrieval knowledge sources"
              icon={Database}
            >
              <KnowledgePage
                activeThread={activeThread}
                sources={ragSources}
                refreshSources={refreshRagSources}
              />
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
          {activePage === "routines" && (
            <StandardPageShell
              title={currentLabel}
              description="Automation health and schedules"
              icon={Workflow}
            >
              <RoutinesPage />
            </StandardPageShell>
          )}
          {activePage === "playground" && <PlaygroundPage />}
        </main>
      </SidebarInset>
      <AlertDialog
        open={Boolean(threadToDelete)}
        onOpenChange={(open) => {
          if (!open) setThreadToDelete(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected chat from your local history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setThreadToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (threadToDelete) deleteThread(threadToDelete.threadId)
                setThreadToDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </SidebarProvider>
      </TooltipProvider>
    </ErrorBoundary>
  )
}

export default App
