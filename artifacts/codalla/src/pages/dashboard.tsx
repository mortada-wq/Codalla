import { useState, useMemo } from "react"
import { useLocation } from "wouter"
import { Layout } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Folder, GitBranch, Clock, ArrowRight, Trash2, Github, ChevronDown, Loader2, MessageSquare, Sparkles, DollarSign, Activity, Cpu, FileText, Wand2 } from "lucide-react"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"
import { useListProjects, useGetUsageSummary, useDeleteProject, useCreateProject, useListConversations, getListProjectsQueryKey, useGetSettings } from "@workspace/api-client-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const projectSchema = z.object({
  name: z.string().trim().min(1, "Give your project a name"),
  description: z.string().optional(),
  gitRemoteUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  githubToken: z.string().optional(),
  aiPrompt: z.string().optional(),
  story: z.string().optional(),
  target: z.string().optional(),
})

export default function Dashboard() {
  const { data: projects, isLoading: isLoadingProjects } = useListProjects()
  const { data: usage, isLoading: isLoadingUsage } = useGetUsageSummary()
  const [search, setSearch] = useState("")

  const filteredProjects = useMemo(() => {
    if (!projects) return []
    const q = search.toLowerCase().trim()
    if (!q) return projects
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    )
  }, [projects, search])

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-7xl mx-auto px-6 py-10 md:px-10 md:py-12 space-y-10">

          {/* ── Page header ────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="type-display text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-[13px]">
                {projects && projects.length > 0
                  ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} — jump back in or start something new.`
                  : "Welcome to Codalla. Create your first project to begin."}
              </p>
            </div>
            <CreateProjectDialog />
          </div>

          {/* ── Usage stats ────────────────────────────────────────── */}
          <section aria-label="Usage summary" className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Today's Cost"
              value={isLoadingUsage ? null : formatCurrency(usage?.todayCost || 0)}
              hint={usage ? `Total ${formatCurrency(usage.totalCost || 0)}` : undefined}
              icon={DollarSign}
            />
            <StatCard
              label="Tokens Processed"
              value={isLoadingUsage ? null : formatNumber(usage?.totalTokens || 0)}
              hint="Across all models"
              icon={Activity}
            />
            <StatCard
              label="API Requests"
              value={isLoadingUsage ? null : formatNumber(usage?.totalRequests || 0)}
              hint="All time"
              icon={Cpu}
            />
          </section>

          {/* ── Projects + Recent chats ────────────────────────────── */}
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="type-section text-foreground">Projects</h2>
                {projects && projects.length > 0 && (
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects…"
                      className="pl-9 h-9 bg-card border-border"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {isLoadingProjects ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map(i => <ProjectCardSkeleton key={i} />)}
                </div>
              ) : filteredProjects.length === 0 ? (
                <EmptyProjectsState hasSearch={Boolean(search)} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredProjects.map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <h2 className="type-section text-foreground">Recent chats</h2>
              <RecentConversations />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ═════════════════════════════════════════════════════════════════════
// STAT CARD — clean, scannable, one number per card
// ═════════════════════════════════════════════════════════════════════
function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string | null; hint?: string; icon: React.ElementType }) {
  return (
    <Card className="bg-card border-border shadow-none hover:border-primary/40 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground/60" />
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-semibold text-foreground font-mono tracking-tight">{value}</div>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════════════
// PROJECT CARD — clear hierarchy, hover feedback, safe delete
// ═════════════════════════════════════════════════════════════════════
function ProjectCard({ project }: { project: any }) {
  const [, setLocation] = useLocation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteProject = useDeleteProject()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const handleDelete = () => {
    deleteProject.mutate({ projectId: project.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        toast({ title: "Project deleted", description: `${project.name} has been removed.` })
        setConfirmOpen(false)
      },
      onError: (err: any) => {
        toast({ title: "Delete failed", description: err.message || "Could not delete the project.", variant: "destructive" })
      }
    })
  }

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setLocation(`/editor/${project.id}`)}
        onKeyDown={(e) => { if (e.key === 'Enter') setLocation(`/editor/${project.id}`) }}
        className="group relative bg-card border-border shadow-none hover:border-primary/50 hover:-translate-y-[1px] transition-all cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary transition-colors shrink-0">
                <Folder className="h-4 w-4" />
              </div>
              <CardTitle className="text-[15px] font-semibold truncate group-hover:text-primary transition-colors">
                {project.name}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${project.name}`}
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true) }}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {project.description && (
            <CardDescription className="line-clamp-2 text-[13px] mt-2 font-sans text-muted-foreground">
              {project.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-2 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              {project.currentBranch || 'main'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatDate(project.updatedAt || project.createdAt)}
            </span>
          </div>
          {project.gitRemoteUrl && (
            <div className="inline-flex items-center gap-1.5 truncate">
              <Github className="h-3 w-3 shrink-0" />
              <span className="truncate">{project.gitRemoteUrl.replace(/^https?:\/\/github\.com\//, '')}</span>
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="font-sans text-[13px]">Open in editor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-foreground">{project.name}</span> and all its files from Codalla. Your GitHub repository will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>Keep project</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="bg-destructive/90 hover:bg-destructive text-destructive-foreground"
            >
              {deleteProject.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Deleting…</>
              ) : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ProjectCardSkeleton() {
  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-3 w-full mt-3" />
        <Skeleton className="h-3 w-2/3 mt-1" />
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════════════
// EMPTY STATE — inviting, clear next step
// ═════════════════════════════════════════════════════════════════════
function EmptyProjectsState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg bg-card/50">
        <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-[15px] font-medium text-foreground">No matches</p>
        <p className="text-[13px] text-muted-foreground mt-1">Try a different search term.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center border border-dashed border-border rounded-lg bg-card/50">
      <div className="p-3 rounded-full bg-primary/10 mb-4">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground">Start your first project</h3>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm">
        Create an empty workspace or clone an existing GitHub repository to start coding with AI.
      </p>
      <div className="mt-6">
        <CreateProjectDialog trigger={
          <Button size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create your first project
          </Button>
        } />
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// CREATE PROJECT DIALOG — tri-mode: blank | GitHub | Generate with AI
// ═════════════════════════════════════════════════════════════════════
type ProjectMode = "blank" | "github" | "ai"

function CreateProjectDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ProjectMode>("blank")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "creating" | "generating">("idle")
  const createProject = useCreateProject()
  const { data: settings } = useGetSettings()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [, setLocation] = useLocation()

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "", gitRemoteUrl: "", githubToken: "", aiPrompt: "", story: "", target: "" },
  })

  const gitUrl = form.watch("gitRemoteUrl")?.trim() ?? ""
  const hasGitUrl = gitUrl.length > 0
  const aiPrompt = form.watch("aiPrompt")?.trim() ?? ""
  const hasAiPrompt = aiPrompt.length >= 3

  const reset = () => {
    form.reset()
    setAdvancedOpen(false)
    setMode("blank")
    setPhase("idle")
  }

  const runGeneration = async (projectId: string) => {
    if (!settings?.defaultModelId || !settings?.defaultProvider) {
      throw new Error("No default model configured. Set one in Settings → General.")
    }
    setPhase("generating")
    const res = await fetch(`/api/projects/${projectId}/generate-files`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: aiPrompt,
        modelId: settings.defaultModelId,
        provider: settings.defaultProvider,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `Generation failed (${res.status})`)
    return data as { filesWritten: Array<{ path: string; sizeBytes: number }>; filesSkipped: string[]; filesTotal: number }
  }

  const onSubmit = (values: z.infer<typeof projectSchema>) => {
    setPhase("creating")
    createProject.mutate({ data: {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      gitRemoteUrl: mode === "github" ? (values.gitRemoteUrl?.trim() || undefined) : undefined,
      githubToken:  mode === "github" ? (values.githubToken?.trim() || undefined) : undefined,
      story: values.story?.trim() || undefined,
      target: values.target?.trim() || undefined,
    } as any }, {
      onSuccess: async (newProject) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })

        if (mode === "ai" && hasAiPrompt) {
          try {
            const gen = await runGeneration(newProject.id)
            toast({
              title: `Wrote ${gen.filesWritten.length} file${gen.filesWritten.length === 1 ? '' : 's'}`,
              description: gen.filesSkipped.length
                ? `Skipped: ${gen.filesSkipped.join(", ")}`
                : "Opening the editor…",
            })
          } catch (err: any) {
            toast({
              title: "Project created, but generation failed",
              description: err?.message ?? "You can still chat with the AI inside the editor.",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: mode === "github" ? "Repository cloned" : "Project created",
            description: "Opening the editor…",
          })
        }
        setOpen(false)
        reset()
        setLocation(`/editor/${newProject.id}`)
      },
      onError: (error: any) => {
        setPhase("idle")
        toast({
          title: mode === "github" ? "Couldn't clone repository" : "Couldn't create project",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        })
      },
    })
  }

  const isBusy = phase !== "idle" || createProject.isPending

  const primaryLabel = (() => {
    if (phase === "generating") return "Generating files with AI…"
    if (phase === "creating") return mode === "github" ? "Cloning repository…" : "Creating project…"
    if (mode === "github") return "Create & clone repository"
    if (mode === "ai") return "Create & generate"
    return "Create project"
  })()

  const canSubmit = !isBusy && form.formState.isValid !== false && (mode !== "ai" || hasAiPrompt)

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="new-project-button">
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 space-y-1">
          <DialogTitle className="text-[17px] font-semibold">New project</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground font-sans">
            {mode === "blank" && "Start from scratch and add files as you go."}
            {mode === "github" && "Pull an existing repository into a fresh workspace."}
            {mode === "ai" && "Describe what you want to build — the AI drafts the initial files for you."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Mode selector ─────────────────────────────────────── */}
        <div className="px-6 pt-2 pb-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 border border-border rounded-md">
            <ModeButton active={mode === "blank"} onClick={() => setMode("blank")} icon={FileText} label="Blank" testId="mode-blank" />
            <ModeButton active={mode === "github"} onClick={() => setMode("github")} icon={Github} label="From GitHub" testId="mode-github" />
            <ModeButton active={mode === "ai"} onClick={() => setMode("ai")} icon={Wand2} label="With AI" testId="mode-ai" />
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-6 pb-4 space-y-5">
              {/* ── Basics ─────────────────────────────────────── */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Project name</FormLabel>
                    <FormControl>
                      <Input placeholder="my-awesome-app" className="bg-background border-border" autoFocus data-testid="project-name-input" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">
                      Description <span className="text-muted-foreground font-normal">— optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="What are you building?" className="bg-background border-border" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Mode-specific block ───────────────────────────── */}
            {mode === "github" && (
              <div className="px-6 py-5 border-y border-border bg-muted/40 space-y-4">
                <div className="flex items-center gap-2">
                  <Github className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Import from GitHub</span>
                </div>
                <FormField
                  control={form.control}
                  name="gitRemoteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Repository URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input placeholder="https://github.com/username/repo" className="bg-background border-border pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                {hasGitUrl && (
                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium">
                          Personal access token <span className="text-muted-foreground font-normal">— private repos only</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="off" placeholder="ghp_••••••••••••••••" className="bg-background border-border font-mono text-[13px]" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          <a href="https://github.com/settings/tokens/new?description=Codalla&scopes=repo" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                            Generate a token on GitHub →
                          </a>{" "}
                          with the <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">repo</code> scope. Used once for the clone; not stored.
                        </p>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {mode === "ai" && (
              <div className="px-6 py-5 border-y border-border bg-primary/[0.04] space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Describe your idea</span>
                </div>
                <FormField
                  control={form.control}
                  name="aiPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder={"e.g. A Next.js 15 blog with MDX posts, Tailwind styling, dark mode toggle, and a simple RSS feed. Include the home page, a [slug] post page, and an example post."}
                          className="bg-background border-border resize-none text-[13px] leading-relaxed"
                          data-testid="ai-prompt-input"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[11px] text-muted-foreground">
                          Uses your default model — <span className="font-mono text-foreground">{settings?.defaultModelId ?? "…"}</span>
                          {settings?.defaultProvider && <span className="ml-1 text-muted-foreground/70">({settings.defaultProvider})</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">{aiPrompt.length} chars</p>
                      </div>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="rounded-md border border-border/60 bg-card/50 px-3 py-2.5 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">Tip:</span> Be specific about tech stack, entry points, and any config files
                  you want (e.g. <code className="font-mono text-[11px]">package.json</code>, <code className="font-mono text-[11px]">tailwind.config.js</code>).
                </div>
              </div>
            )}

            {/* ── Advanced (progressive disclosure) ───────────── */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full px-6 py-3 flex items-center justify-between text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Add context to help the AI
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-4 space-y-4">
                <FormField
                  control={form.control}
                  name="story"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">
                        Story <span className="text-muted-foreground font-normal">— why does this project exist?</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="A journaling app for solo travellers" className="bg-background border-border" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">
                        Target <span className="text-muted-foreground font-normal">— what does done look like?</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="MVP live for 10 beta users by month-end" className="bg-background border-border" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* ── Footer ─────────────────────────────────────── */}
            <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 sm:justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); reset() }} disabled={isBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit} className="min-w-[200px]" data-testid="submit-project">
                {isBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {primaryLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ModeButton({ active, onClick, icon: Icon, label, testId }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 rounded-[4px] text-[12px] font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════════
// RECENT CONVERSATIONS
// ═════════════════════════════════════════════════════════════════════
function RecentConversations() {
  const { data: conversations, isLoading } = useListConversations({})
  const [, setLocation] = useLocation()

  return (
    <Card className="bg-card border-border shadow-none">
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-[13px] text-muted-foreground">No recent chats</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Open a project to start chatting with AI.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.slice(0, 6).map(conv => (
              <button
                key={conv.id}
                onClick={() => setLocation(conv.projectId ? `/editor/${conv.projectId}` : '/')}
                className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-muted transition-colors group text-left"
              >
                <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-[11px] shrink-0 group-hover:bg-primary/20 transition-colors">
                  AI
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[13px] font-medium truncate text-foreground group-hover:text-primary transition-colors">
                    {conv.title || "Untitled conversation"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mt-0.5">
                    <span className="capitalize">{conv.provider}</span>
                    <span>·</span>
                    <span>{formatDate(conv.updatedAt || conv.createdAt)}</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
