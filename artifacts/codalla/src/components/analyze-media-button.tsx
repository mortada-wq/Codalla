import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Sparkles, Image as ImageIcon, Music, Check, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useGetSettings } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { getGetFileTreeQueryKey } from "@workspace/api-client-react"
import { cn } from "@/lib/utils"

interface AnalyzeMediaButtonProps {
  projectId: string
}

interface AnalyzeResult {
  results: Array<{ path: string; description?: string; error?: string }>
  scanned: number
  described: number
  failed: number
  message?: string
}

/**
 * A single button that opens a compact modal for AI-powered media analysis.
 * Uses the user's default model. Writes descriptions as sibling `.md` files
 * and a rolled-up `CODALLA_MEDIA.md` at the project root.
 */
export function AnalyzeMediaButton({ projectId }: AnalyzeMediaButtonProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"both" | "images" | "audio">("both")
  const [instructions, setInstructions] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const { data: settings } = useGetSettings()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const reset = () => { setBusy(false); setResult(null); setInstructions(""); setType("both") }

  const run = async () => {
    if (!settings?.defaultModelId || !settings?.defaultProvider) {
      toast({ title: "No default model", description: "Set one in Settings → General first.", variant: "destructive" })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze-media`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          modelId: settings.defaultModelId,
          provider: settings.defaultProvider,
          instructions: instructions.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Analysis failed (${res.status})`)
      setResult(data)
      // Refresh the file tree so newly-written .md files appear
      queryClient.invalidateQueries({ queryKey: getGetFileTreeQueryKey(projectId) })
      if (data.described > 0) {
        toast({
          title: `Described ${data.described} file${data.described === 1 ? '' : 's'}`,
          description: data.failed
            ? `${data.failed} file(s) skipped — check the report.`
            : "Descriptions saved next to each file and in CODALLA_MEDIA.md",
        })
      } else if (data.scanned === 0) {
        toast({ title: "Nothing to analyze", description: data.message ?? "No matching files found." })
      }
    } catch (err: any) {
      toast({ title: "Couldn't analyze media", description: err?.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-5 w-5 hover:bg-muted text-muted-foreground hover:text-primary"
        title="Analyze images & audio with AI"
        data-testid="analyze-media-trigger"
      >
        <Sparkles className="h-3 w-3" />
      </Button>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 space-y-1">
          <DialogTitle className="text-[17px] font-semibold inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analyze media with AI
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground font-sans">
            Scan the project for images and audio and let the model write descriptions next to each file.
            Requires a vision- or audio-capable model.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Type selector */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What to analyze</p>
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 border border-border rounded-md">
              <TypeButton active={type === "both"} onClick={() => setType("both")} label="Both" />
              <TypeButton active={type === "images"} onClick={() => setType("images")} icon={ImageIcon} label="Images" />
              <TypeButton active={type === "audio"} onClick={() => setType("audio")} icon={Music} label="Audio" />
            </div>
          </div>

          {/* Instructions override */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">
              Instructions <span className="text-muted-foreground font-normal">— optional</span>
            </label>
            <textarea
              rows={3}
              placeholder="Leave blank for defaults. Or steer the model: e.g. &quot;focus on production tricks and mixing techniques&quot; for audio."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] leading-relaxed resize-none placeholder:text-muted-foreground/60"
              data-testid="analyze-instructions"
            />
          </div>

          {/* Model info */}
          <div className="text-[12px] text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/30">
            Using <span className="font-mono text-foreground">{settings?.defaultModelId ?? "…"}</span>
            {settings?.defaultProvider && <span className="text-muted-foreground/70"> ({settings.defaultProvider})</span>}
            <br />
            <span className="text-muted-foreground/80">
              Tip: <span className="font-medium">Claude 3.5 Sonnet</span> or <span className="font-medium">GPT-4o</span>{" "}
              handle images well. Audio requires an audio-capable model.
            </span>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-2 border border-border rounded-md">
              <div className="px-3 py-2 border-b border-border bg-muted/30 flex justify-between text-[12px]">
                <span className="font-medium">Report</span>
                <span className="font-mono text-muted-foreground">
                  {result.described}/{result.scanned} described · {result.failed} failed
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-border">
                {result.results.length === 0 && (
                  <div className="px-3 py-4 text-[13px] text-muted-foreground text-center">
                    {result.message ?? "No media files found."}
                  </div>
                )}
                {result.results.map((r) => (
                  <div key={r.path} className="px-3 py-2 flex items-start gap-2 text-[12px]">
                    {r.description ? (
                      <Check className="h-3 w-3 text-success shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono truncate">{r.path}</p>
                      {r.error && <p className="text-destructive text-[11px] mt-0.5 truncate">{r.error}</p>}
                      {r.description && (
                        <p className="text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 sm:justify-end gap-2">
          <Button variant="ghost" onClick={() => { setOpen(false); reset() }} disabled={busy}>
            Close
          </Button>
          <Button onClick={run} disabled={busy} className="min-w-[140px]" data-testid="analyze-run">
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {busy ? "Analyzing…" : result ? "Run again" : "Start analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TypeButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon?: React.ElementType; label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 rounded-[4px] text-[12px] font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}
