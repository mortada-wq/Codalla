import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useListWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow, getListWorkflowsQueryKey } from "@workspace/api-client-react"
import { Layout } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, ArrowUp, ArrowDown, Workflow as WorkflowIcon, Pencil, ListOrdered, Users } from "lucide-react"

interface Step { title: string; prompt: string }
interface WorkflowRow { id: string; name: string; description?: string | null; steps: Step[]; isShared?: boolean; isOwner?: boolean }

// Starter presets — editable examples, not hardcoded behavior. The same
// step-runner handles any modality (chat data, images, code, docs).
const TEMPLATES: Array<{ name: string; description: string; steps: Step[] }> = [
  {
    name: "Chat fine-tune data prep",
    description: "Turn raw text/CSV into clean JSONL chat training data",
    steps: [
      { title: "Inventory the data", prompt: "List every data file in this project with a one-line description of its structure (columns, format, encoding issues you can spot)." },
      { title: "Define the schema", prompt: "Propose a JSONL chat-format schema (system/user/assistant messages) for fine-tuning, based on the data we have. Write it to SCHEMA.md as a full file." },
      { title: "Convert", prompt: "Convert the raw data files into JSONL following SCHEMA.md. Output complete converted files (train.jsonl, and val.jsonl with a 10% split)." },
      { title: "Quality check", prompt: "Scan the converted JSONL for duplicates, empty completions, encoding artifacts, and label imbalance. Write findings and fixes to QC_REPORT.md as a full file." },
    ],
  },
  {
    name: "Image dataset prep",
    description: "Organize and document an image dataset for training",
    steps: [
      { title: "Inventory", prompt: "List the image files and folder structure in this project. Identify the labeling convention (folder names, filename patterns, or sidecar files)." },
      { title: "Manifest", prompt: "Generate a manifest.csv (full file) with columns: path, label, split. Use an 80/10/10 train/val/test split, stratified by label." },
      { title: "Preprocessing script", prompt: "Write preprocess.py (full file) that resizes images to a configurable resolution, normalizes, and validates each file in manifest.csv, logging corrupt files to skipped.txt." },
      { title: "Dataset card", prompt: "Write DATASET.md (full file): class counts, split sizes, known biases or gaps, and how to regenerate the manifest." },
    ],
  },
  {
    name: "Vibe coding sprint",
    description: "Scaffold, build, and check a feature in one pass",
    steps: [
      { title: "Plan", prompt: "Read the project context and propose a short implementation plan for the feature I describe next. Wait for my confirmation in the plan before large rewrites." },
      { title: "Scaffold", prompt: "Create the files from the plan as complete files." },
      { title: "Edge cases", prompt: "Review what you just wrote for edge cases, missing error handling, and inconsistencies. Output corrected full files where needed." },
    ],
  },
]

const emptyDraft = (): { id: string | null; name: string; description: string; steps: Step[]; isShared: boolean } =>
  ({ id: null, name: "", description: "", steps: [{ title: "", prompt: "" }], isShared: false })

export default function WorkflowsPage() {
  const { data: workflows, isLoading } = useListWorkflows()
  const createWorkflow = useCreateWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [deleting, setDeleting] = useState<WorkflowRow | null>(null)

  const openNew = (tpl?: (typeof TEMPLATES)[number]) => {
    setDraft(tpl
      ? { id: null, name: tpl.name, description: tpl.description, steps: tpl.steps.map(s => ({ ...s })), isShared: false }
      : emptyDraft())
    setDialogOpen(true)
  }
  const openEdit = (w: WorkflowRow) => {
    setDraft({ id: w.id, name: w.name, description: w.description ?? "", steps: w.steps.map(s => ({ ...s })), isShared: w.isShared ?? false })
    setDialogOpen(true)
  }

  const setStep = (i: number, patch: Partial<Step>) =>
    setDraft(d => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft(d => {
      const steps = [...d.steps]
      const j = i + dir
      if (j < 0 || j >= steps.length) return d
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...d, steps }
    })
  const removeStep = (i: number) =>
    setDraft(d => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }))

  const validSteps = draft.steps.filter(s => s.title.trim() && s.prompt.trim())
  const canSave = draft.name.trim().length > 0 && validSteps.length > 0

  const save = () => {
    const data = {
      name: draft.name.trim(),
      isShared: draft.isShared,
      description: draft.description.trim() || undefined,
      steps: validSteps.map(s => ({ title: s.title.trim(), prompt: s.prompt.trim() })),
    }
    const opts = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() })
        setDialogOpen(false)
        toast({ title: draft.id ? "Workflow updated" : "Workflow created" })
      },
      onError: (err: any) => toast({ title: "Couldn't save workflow", description: err?.message, variant: "destructive" }),
    }
    if (draft.id) updateWorkflow.mutate({ workflowId: draft.id, data }, opts)
    else createWorkflow.mutate({ data }, opts)
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteWorkflow.mutate({ workflowId: deleting.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() })
        toast({ title: "Workflow deleted" })
      },
    })
    setDeleting(null)
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl mx-auto px-6 py-10 md:px-10 md:py-12 space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="type-display text-foreground">Workflows</h1>
              <p className="text-muted-foreground mt-1 text-[13px] max-w-xl">
                Reusable AI pipelines — an ordered list of steps you run inside any project.
                Nothing is hardcoded to a data type: the same runner handles chat data, images, code, or docs.
              </p>
            </div>
            <Button onClick={() => openNew()} data-testid="new-workflow-button">
              <Plus className="mr-2 h-4 w-4" />
              New workflow
            </Button>
          </div>

          {/* ── Starter templates ─────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">Start from a template</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => openNew(tpl)}
                  className="text-left rounded-md border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                  data-testid={`template-${tpl.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <p className="text-[13px] font-semibold">{tpl.name}</p>
                  <p className="text-[12px] text-muted-foreground mt-1">{tpl.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-2 font-mono flex items-center gap-1">
                    <ListOrdered className="h-3 w-3" />{tpl.steps.length} steps
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Saved workflows ───────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">Your workflows</p>
            {isLoading ? (
              <p className="text-[13px] text-muted-foreground">Loading…</p>
            ) : !workflows?.length ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <WorkflowIcon className="h-8 w-8 mx-auto text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground mt-3">
                  No workflows yet. Create one, or start from a template above — then run it from any project's chat panel.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(workflows as WorkflowRow[]).map((w) => (
                  <div key={w.id} className="flex items-center gap-4 rounded-md border border-border bg-card px-4 py-3" data-testid={`workflow-${w.id}`}>
                    <WorkflowIcon className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate flex items-center gap-2">
                        {w.name}
                        {w.isShared && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide" data-testid="team-badge">
                            <Users className="h-2.5 w-2.5" />
                            Team
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {w.steps.length} step{w.steps.length === 1 ? "" : "s"}
                        {w.description ? ` · ${w.description}` : ""}
                        {w.isShared && !w.isOwner ? " · shared by a teammate" : ""}
                      </p>
                    </div>
                    {w.isOwner !== false && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(w)} aria-label="Edit workflow">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(w)} aria-label="Delete workflow">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create / edit dialog ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[17px]">{draft.id ? "Edit workflow" : "New workflow"}</DialogTitle>
            <DialogDescription className="text-[13px]">
              Each step is a prompt sent to the AI in order, inside the project you run it on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Workflow name"
              value={draft.name}
              onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
              data-testid="workflow-name"
            />
            <Input
              placeholder="Short description (optional)"
              value={draft.description}
              onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
            />

            <label className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5 cursor-pointer">
              <span className="flex items-center gap-2 text-[13px]">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Share with team
                <span className="text-[12px] text-muted-foreground">— everyone can run it; only you can edit</span>
              </span>
              <Switch
                checked={draft.isShared}
                onCheckedChange={(v) => setDraft(d => ({ ...d, isShared: v }))}
                data-testid="share-workflow-switch"
              />
            </label>

            <div className="space-y-3">
              {draft.steps.map((step, i) => (
                <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                    <Input
                      placeholder="Step title"
                      value={step.title}
                      onChange={(e) => setStep(i, { title: e.target.value })}
                      className="h-8 text-[13px]"
                      data-testid={`step-title-${i}`}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label="Move step up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} aria-label="Move step down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeStep(i)} disabled={draft.steps.length === 1} aria-label="Remove step">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="What should the AI do in this step?"
                    value={step.prompt}
                    onChange={(e) => setStep(i, { prompt: e.target.value })}
                    rows={3}
                    className="text-[13px] resize-none"
                    data-testid={`step-prompt-${i}`}
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setDraft(d => ({ ...d, steps: [...d.steps, { title: "", prompt: "" }] }))}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add step
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave || createWorkflow.isPending || updateWorkflow.isPending} data-testid="save-workflow">
              {draft.id ? "Save changes" : "Create workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────────── */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This removes the workflow preset for everyone using it. Projects and data are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}
