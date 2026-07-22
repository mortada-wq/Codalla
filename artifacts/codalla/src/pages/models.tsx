import { Layout } from "@/components/layout"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useListModels } from "@workspace/api-client-react"
import { Plus, Trash2, Edit2, Blocks, Cpu, DollarSign, Copy, Check, AlertCircle, RefreshCw, WifiOff, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════
// TYPES + SCHEMA
// ═══════════════════════════════════════════════════════════════════════
interface CustomModel {
  id: string
  name: string
  modelId: string
  provider: string
  description: string | null
  contextLength: number | null
  pricingPrompt: number | null
  pricingCompletion: number | null
  isEnabled: boolean
  createdAt: string
}

const MODEL_ID_RE = /^[a-zA-Z0-9._\-\/:@]+$/

const modelSchema = z.object({
  name: z.string().trim().min(1, "Display name is required").max(80, "Keep it under 80 characters"),
  modelId: z.string().trim().min(1, "Model ID is required").max(200)
    .regex(MODEL_ID_RE, "Only letters, digits, and . _ - / : @"),
  provider: z.enum(["siliconflow", "openrouter", "runpod", "custom"]),
  description: z.string().optional().or(z.literal("")),
  contextLength: z.coerce.number().int().positive("Must be > 0").max(2_000_000, "Too large").default(8192),
  pricingPrompt: z.coerce.number().min(0, "Cannot be negative").default(0),
  pricingCompletion: z.coerce.number().min(0, "Cannot be negative").default(0),
  isEnabled: z.boolean().default(true),
})
type ModelForm = z.infer<typeof modelSchema>

// ═══════════════════════════════════════════════════════════════════════
// PROVIDER CONFIG — smart defaults, placeholders, id-format hints
// ═══════════════════════════════════════════════════════════════════════
const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    badge: "purple" as const,
    idPlaceholder: "anthropic/claude-3.5-sonnet",
    idHint: "Format: vendor/model or vendor/model:tag",
    defaultContext: 128000,
    defaultPricing: { prompt: 3, completion: 15 },
  },
  siliconflow: {
    label: "SiliconFlow",
    badge: "info" as const,
    idPlaceholder: "deepseek-ai/DeepSeek-V3",
    idHint: "Format: vendor/model",
    defaultContext: 65536,
    defaultPricing: { prompt: 1.33, completion: 1.33 },
  },
  runpod: {
    label: "RunPod",
    badge: "warning" as const,
    idPlaceholder: "tgi-hosted",
    idHint: "Any string works — TGI accepts your local model name",
    defaultContext: 32768,
    defaultPricing: { prompt: 0, completion: 0 },
  },
  custom: {
    label: "Custom",
    badge: "outline" as const,
    idPlaceholder: "gpt-4o",
    idHint: "Whatever your OpenAI-compatible endpoint expects",
    defaultContext: 8192,
    defaultPricing: { prompt: 0, completion: 0 },
  },
} as const

type ProviderId = keyof typeof PROVIDERS

// ═══════════════════════════════════════════════════════════════════════
// CUSTOM MODELS — hook with retry + optimistic updates
// ═══════════════════════════════════════════════════════════════════════
function useCustomModels() {
  const [models, setModels] = useState<CustomModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/models/custom")
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      setModels(data)
    } catch (err: any) {
      setError(err?.message || "Couldn't load custom models. Check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Track connectivity so we can show an offline banner
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); refetch() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [refetch])

  // Optimistic replace helper — assumes success and rolls back on error
  const optimisticUpdate = (id: string, patch: Partial<CustomModel>) => {
    const prev = models
    setModels(m => m.map(x => x.id === id ? { ...x, ...patch } : x))
    return () => setModels(prev)
  }

  return { models, setModels, isLoading, error, isOnline, refetch, optimisticUpdate }
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function ModelsPage() {
  const { models, isLoading, error, isOnline, refetch, optimisticUpdate } = useCustomModels()
  const { data: builtIn, isError: builtInError, refetch: refetchBuiltIn } = useListModels()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomModel | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CustomModel | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (m: CustomModel) => { setEditing(m); setDialogOpen(true) }

  // Detect duplicates by (provider + modelId)
  const isDuplicate = (values: ModelForm, ignoreId?: string) =>
    models.some(m => m.id !== ignoreId && m.provider === values.provider && m.modelId === values.modelId)

  const handleSubmit = async (values: ModelForm) => {
    if (isDuplicate(values, editing?.id)) {
      toast({
        title: "This model already exists",
        description: `${PROVIDERS[values.provider as ProviderId].label} · ${values.modelId} is already in your list.`,
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const url = editing ? `/api/models/custom/${editing.id}` : "/api/models/custom"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Server returned ${res.status}`)
      }
      toast({ title: editing ? "Model updated" : "Model added" })
      setDialogOpen(false)
      setEditing(null)
      refetch()
    } catch (err: any) {
      // Keep dialog open on failure so user doesn't lose their input
      toast({
        title: editing ? "Couldn't update model" : "Couldn't add model",
        description: err?.message || "Something went wrong. Your changes are preserved — try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    const rollback = optimisticUpdate(confirmDelete.id, {})
    try {
      const res = await fetch(`/api/models/custom/${confirmDelete.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      toast({ title: "Model deleted", description: `${confirmDelete.name} was removed.` })
      setConfirmDelete(null)
      refetch()
    } catch (err: any) {
      rollback()
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleEnabled = async (model: CustomModel) => {
    // Optimistic — feels instant
    const rollback = optimisticUpdate(model.id, { isEnabled: !model.isEnabled })
    try {
      const res = await fetch(`/api/models/custom/${model.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !model.isEnabled }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
    } catch (err: any) {
      rollback()
      toast({ title: "Couldn't update", description: "Reverted the change. Try again.", variant: "destructive" })
    }
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl mx-auto px-6 py-10 md:px-10 md:py-12 space-y-10">

          {/* ── Offline banner ─────────────────────────────────────── */}
          {!isOnline && (
            <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-[13px]">
              <WifiOff className="h-4 w-4 text-warning shrink-0" />
              <span className="text-foreground">
                You&apos;re offline. Changes won&apos;t save until you reconnect.
              </span>
            </div>
          )}

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="type-display text-foreground">Models</h1>
              <p className="text-muted-foreground mt-1 text-[13px] max-w-2xl">
                Codalla ships with popular models built in. Add your own to bring in fine-tunes,
                latest releases, or any OpenAI-compatible endpoint.
              </p>
            </div>
            <Button onClick={openAdd} size="lg" className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Add model
            </Button>
          </div>

          {/* ── Built-in models ────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="type-section text-foreground">Built-in</h2>
              <p className="text-xs text-muted-foreground">Always available · configured server-side</p>
            </div>
            {builtInError ? (
              <ErrorState message="Couldn't reach the server to list built-in models." onRetry={() => refetchBuiltIn()} />
            ) : !builtIn ? (
              <div className="grid gap-2 md:grid-cols-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {builtIn.map(m => (
                  <BuiltInRow key={m.id} model={m} />
                ))}
              </div>
            )}
          </section>

          {/* ── Custom models ──────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="type-section text-foreground">Your custom models</h2>
              <p className="text-xs text-muted-foreground">
                {models.length > 0 && `${models.length} configured`}
              </p>
            </div>

            {error ? (
              <ErrorState message={error} onRetry={refetch} />
            ) : isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : models.length === 0 ? (
              <EmptyState onAdd={openAdd} />
            ) : (
              <div className="space-y-2">
                {models.map(model => (
                  <CustomModelRow
                    key={model.id}
                    model={model}
                    onEdit={() => openEdit(model)}
                    onDelete={() => setConfirmDelete(model)}
                    onToggle={() => toggleEnabled(model)}
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── Add / Edit dialog ────────────────────────────────────── */}
      <ModelFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        isSaving={isSaving}
        existingModels={models}
        onSubmit={handleSubmit}
      />

      {/* ── Delete confirmation ──────────────────────────────────── */}
      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this model?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{confirmDelete?.name}</span> will be removed from your list.
              You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep model</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive/90 hover:bg-destructive text-destructive-foreground"
            >
              {isDeleting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Deleting…</> : "Delete model"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// BUILT-IN MODEL ROW — compact, monospace, click-to-copy
// ═══════════════════════════════════════════════════════════════════════
function BuiltInRow({ model }: { model: { id: string; name: string; provider: string; contextLength?: number | null } }) {
  const provider = PROVIDERS[model.provider as ProviderId]
  const [copied, setCopied] = useState(false)
  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(model.id).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  return (
    <div className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 hover:border-border/80 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground truncate">{model.name}</span>
          <Badge variant={provider?.badge ?? "outline"} className="capitalize font-mono text-[10px] px-1.5 py-0 shrink-0">
            {provider?.label ?? model.provider}
          </Badge>
        </div>
        <button
          onClick={copyId}
          title="Copy model ID"
          className="mt-0.5 flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors max-w-full"
        >
          <span className="truncate">{model.id}</span>
          {copied ? <Check className="h-3 w-3 text-success shrink-0" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />}
        </button>
      </div>
      {model.contextLength ? (
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          {(model.contextLength / 1000).toFixed(0)}k
        </span>
      ) : null}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CUSTOM MODEL ROW — richer, editable, keyboard-friendly
// ═══════════════════════════════════════════════════════════════════════
function CustomModelRow({ model, onEdit, onDelete, onToggle }: {
  model: CustomModel; onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  const provider = PROVIDERS[model.provider as ProviderId]
  const [copied, setCopied] = useState(false)
  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(model.modelId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <Card className={cn(
      "bg-card border-border shadow-none transition-all",
      !model.isEnabled && "opacity-60"
    )}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-foreground">{model.name}</span>
              <Badge variant={provider?.badge ?? "outline"} className="capitalize font-mono text-[10px] px-1.5 py-0">
                {provider?.label ?? model.provider}
              </Badge>
              {!model.isEnabled && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground uppercase tracking-wider">
                  Hidden
                </Badge>
              )}
            </div>

            <button
              onClick={copyId}
              title="Copy model ID"
              className="mt-1 group inline-flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="truncate max-w-[400px]">{model.modelId}</span>
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />}
            </button>

            {model.description && (
              <p className="text-[13px] text-muted-foreground mt-2 max-w-2xl">{model.description}</p>
            )}

            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {model.contextLength ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground">
                  <Cpu className="h-3 w-3" />
                  {(model.contextLength / 1000).toFixed(0)}k context
                </span>
              ) : null}
              {(model.pricingPrompt || model.pricingCompletion) ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  ${model.pricingPrompt}/1M in · ${model.pricingCompletion}/1M out
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Switch
              checked={model.isEnabled}
              onCheckedChange={onToggle}
              aria-label={`${model.isEnabled ? 'Disable' : 'Enable'} ${model.name}`}
            />
            <div className="w-2" />
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${model.name}`} onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${model.name}`}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STATES — empty, error
// ═══════════════════════════════════════════════════════════════════════
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-border rounded-lg bg-card/50">
      <div className="p-3 rounded-full bg-primary/10 mb-4">
        <Blocks className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground">No custom models yet</h3>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-md">
        Add a fine-tuned model, a new release, or any OpenAI-compatible endpoint to expand your model picker.
      </p>
      <Button onClick={onAdd} size="lg" className="mt-6">
        <Plus className="mr-2 h-4 w-4" />
        Add your first model
      </Button>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center border border-dashed border-destructive/40 rounded-lg bg-destructive/5">
      <AlertCircle className="h-6 w-6 text-destructive mb-3" />
      <p className="text-[13px] font-medium text-foreground">Couldn&apos;t load your models</p>
      <p className="text-[12px] text-muted-foreground mt-1 max-w-md">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// FORM DIALOG — the star of the vibe-coding pipeline
//   • Live validation, smart defaults per provider, duplicate detection
//   • Live preview of how the model will render in the picker
//   • Save disabled until form is truly valid + not duplicate
//   • Form state preserved on save failure
// ═══════════════════════════════════════════════════════════════════════
function ModelFormDialog({
  open, onOpenChange, editing, isSaving, existingModels, onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: CustomModel | null
  isSaving: boolean
  existingModels: CustomModel[]
  onSubmit: (values: ModelForm) => Promise<void> | void
}) {
  const form = useForm<ModelForm>({
    resolver: zodResolver(modelSchema),
    mode: "onChange", // real-time validation
    defaultValues: {
      name: "",
      modelId: "",
      provider: "openrouter",
      description: "",
      contextLength: PROVIDERS.openrouter.defaultContext,
      pricingPrompt: PROVIDERS.openrouter.defaultPricing.prompt,
      pricingCompletion: PROVIDERS.openrouter.defaultPricing.completion,
      isEnabled: true,
    },
  })

  // Reset form whenever the dialog opens with a new context (edit vs add)
  useEffect(() => {
    if (!open) return
    if (editing) {
      form.reset({
        name: editing.name,
        modelId: editing.modelId,
        provider: editing.provider as ProviderId,
        description: editing.description ?? "",
        contextLength: editing.contextLength ?? 8192,
        pricingPrompt: editing.pricingPrompt ?? 0,
        pricingCompletion: editing.pricingCompletion ?? 0,
        isEnabled: editing.isEnabled,
      })
    } else {
      form.reset({
        name: "", modelId: "", provider: "openrouter",
        description: "",
        contextLength: PROVIDERS.openrouter.defaultContext,
        pricingPrompt: PROVIDERS.openrouter.defaultPricing.prompt,
        pricingCompletion: PROVIDERS.openrouter.defaultPricing.completion,
        isEnabled: true,
      })
    }
  }, [open, editing, form])

  const values = form.watch()
  const providerCfg = PROVIDERS[values.provider as ProviderId] ?? PROVIDERS.custom

  // Smart defaults: whenever provider changes AND the current defaults haven't been
  // overridden, refresh context/pricing to match the provider's typical values.
  const lastProvider = useMemo(() => ({ current: values.provider }), [])
  useEffect(() => {
    if (editing) return // don't muck with existing values while editing
    if (values.provider === lastProvider.current) return
    lastProvider.current = values.provider
    const cfg = PROVIDERS[values.provider as ProviderId]
    if (cfg) {
      form.setValue("contextLength", cfg.defaultContext, { shouldValidate: true })
      form.setValue("pricingPrompt", cfg.defaultPricing.prompt, { shouldValidate: true })
      form.setValue("pricingCompletion", cfg.defaultPricing.completion, { shouldValidate: true })
    }
  }, [values.provider, editing, form, lastProvider])

  // Duplicate detection for live feedback
  const isDuplicate = useMemo(() => {
    if (!values.modelId?.trim() || !values.provider) return false
    return existingModels.some(m =>
      m.id !== editing?.id &&
      m.provider === values.provider &&
      m.modelId === values.modelId.trim()
    )
  }, [values.modelId, values.provider, existingModels, editing])

  const isSubmittable = form.formState.isValid && !isDuplicate && !isSaving

  const submit = form.handleSubmit(onSubmit)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 space-y-1">
          <DialogTitle className="text-[17px] font-semibold">
            {editing ? "Edit model" : "Add a model"}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground font-sans">
            Any OpenAI-compatible model works. Pricing is used for cost tracking only.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit}>
            {/* ── Identity group ──────────────────────────────────── */}
            <div className="px-6 py-5 space-y-4">
              <SectionLabel>Identity</SectionLabel>

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-[13px] font-medium">Display name</FormLabel>
                      <FormControl>
                        <Input placeholder="Claude 3.5 Sonnet" className="bg-background border-border" autoFocus {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Provider</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(PROVIDERS) as ProviderId[]).map(p => (
                            <SelectItem key={p} value={p}>{PROVIDERS[p].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="modelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Model ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={providerCfg.idPlaceholder}
                        className="bg-background border-border font-mono text-[13px]"
                        {...field}
                      />
                    </FormControl>
                    {!form.formState.errors.modelId && !isDuplicate && (
                      <p className="text-xs text-muted-foreground mt-1">{providerCfg.idHint}</p>
                    )}
                    {isDuplicate && !form.formState.errors.modelId && (
                      <p className="text-xs text-destructive mt-1">
                        You already have this model configured for {providerCfg.label}.
                      </p>
                    )}
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
                      <Input placeholder="Anthropic's flagship model, best for coding" className="bg-background border-border" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Capabilities group ─────────────────────────────── */}
            <div className="px-6 py-5 border-t border-border bg-muted/30 space-y-4">
              <SectionLabel>Capabilities</SectionLabel>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contextLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Context window (tokens)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} className="bg-background border-border font-mono text-[13px]" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-end">
                      <FormLabel className="text-[13px] font-medium">Show in picker</FormLabel>
                      <div className="flex items-center gap-2 h-9">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <span className="text-[13px] text-muted-foreground">
                          {field.value ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Pricing group ──────────────────────────────────── */}
            <div className="px-6 py-5 border-t border-border space-y-4">
              <SectionLabel hint="Used for cost tracking only">Pricing (per 1M tokens)</SectionLabel>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="pricingPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Input</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[13px]">$</span>
                          <Input type="number" step="0.01" min={0} className="bg-background border-border font-mono text-[13px] pl-7" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricingCompletion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Output</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[13px]">$</span>
                          <Input type="number" step="0.01" min={0} className="bg-background border-border font-mono text-[13px] pl-7" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Live preview ───────────────────────────────────── */}
            {values.name && values.modelId && !isDuplicate && (
              <div className="px-6 py-4 border-t border-border bg-primary/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Preview in picker</span>
                </div>
                <div className="rounded border border-border bg-background px-3 py-2 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{values.name}</span>
                  <Badge variant={providerCfg.badge} className="capitalize font-mono text-[10px] px-1.5 py-0">
                    {providerCfg.label}
                  </Badge>
                  <span className="text-[12px] font-mono text-muted-foreground truncate">{values.modelId}</span>
                </div>
              </div>
            )}

            {/* ── Footer ─────────────────────────────────────────── */}
            <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 sm:justify-between gap-2">
              <span className="text-[12px] text-muted-foreground self-center">
                {form.formState.isValid && !isDuplicate ? "Ready to save" : "Fill required fields to continue"}
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isSubmittable} className="min-w-[140px]">
                  {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {isSaving ? "Saving…" : editing ? "Save changes" : "Add model"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  )
}
