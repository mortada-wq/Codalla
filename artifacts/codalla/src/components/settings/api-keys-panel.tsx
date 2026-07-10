import { useState } from "react"
import { useListApiKeys, useCreateApiKey, useDeleteApiKey, useUpdateApiKey, getListApiKeysQueryKey } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Key, Plus, Trash2, Shield, Eye, EyeOff, Lock, Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"

const apiKeySchema = z.object({
  provider: z.enum(["siliconflow", "openrouter", "runpod", "custom"]),
  label: z.string().min(1, "Give this key a label"),
  keyValue: z.string().min(1, "API key is required"),
  baseUrl: z.string().url().optional().or(z.literal("")),
})

export function ApiKeysPanel() {
  const { data: keys, isLoading } = useListApiKeys()
  const deleteKey = useDeleteApiKey()
  const updateKey = useUpdateApiKey()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null)

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    updateKey.mutate({ keyId: id, data: { isActive: !currentStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() })
        toast({ title: currentStatus ? "Key deactivated" : "Key activated" })
      },
      onError: (err: any) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
    })
  }

  const handleDelete = () => {
    if (!confirmDelete) return
    deleteKey.mutate({ keyId: confirmDelete.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() })
        toast({ title: "Key deleted", description: `${confirmDelete.label} was removed.` })
        setConfirmDelete(null)
      },
      onError: (err: any) => {
        toast({ title: "Delete failed", description: err?.message, variant: "destructive" })
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Provider keys</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {keys?.length ? `${keys.length} key${keys.length === 1 ? '' : 's'} configured.` : "Add a key to start using AI features."}
          </p>
        </div>
        <CreateKeyDialog />
      </div>

      <Card className="bg-card border-border shadow-none overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[140px] text-[11px] font-semibold uppercase tracking-wider">Provider</TableHead>
              <TableHead className="w-[200px] text-[11px] font-semibold uppercase tracking-wider">Label</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Key</TableHead>
              <TableHead className="w-[110px] text-[11px] font-semibold uppercase tracking-wider">Added</TableHead>
              <TableHead className="w-[80px] text-[11px] font-semibold uppercase tracking-wider text-center">Active</TableHead>
              <TableHead className="w-[64px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !keys || keys.length === 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={6} className="h-52 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="p-3 rounded-full bg-primary/10 mb-3">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">No API keys yet</p>
                    <p className="text-[13px] mt-1">Add a provider key to start using AI models.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id} className="border-border group">
                  <TableCell>
                    <Badge
                      variant={
                        key.provider === 'openrouter' ? 'purple' :
                        key.provider === 'siliconflow' ? 'info' :
                        key.provider === 'runpod' ? 'warning' : 'outline'
                      }
                      className="capitalize font-mono text-[11px]"
                    >
                      {key.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-[13px] text-foreground">{key.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground font-mono text-[12px]">
                      <Lock className="h-3 w-3" />
                      {key.maskedKey || "sk-••••••••••••••••"}
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground font-mono">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={key.isActive}
                      onCheckedChange={() => handleToggleActive(key.id, key.isActive)}
                      disabled={updateKey.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${key.label}`}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setConfirmDelete({ id: key.id, label: key.label })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-primary/5 border-primary/20 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] flex items-center gap-2 text-primary font-semibold">
            <Shield className="h-3.5 w-3.5" />
            Where are my keys stored?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground font-sans leading-relaxed">
            Keys are stored in this workspace's database only. Codalla connects directly to your providers from your server —
            your keys never leave your instance.
          </p>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{confirmDelete?.label}</span> will be permanently removed.
              Any project using this key will stop working with its provider until you add a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteKey.isPending}>Keep key</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteKey.isPending}
              className="bg-destructive/90 hover:bg-destructive text-destructive-foreground"
            >
              {deleteKey.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Deleting…</> : "Delete key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateKeyDialog() {
  const [open, setOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const createKey = useCreateApiKey()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const form = useForm<z.infer<typeof apiKeySchema>>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { provider: "openrouter", label: "", keyValue: "", baseUrl: "" },
  })

  const provider = form.watch("provider")
  const showBaseUrl = provider === "custom" || provider === "runpod"

  const onSubmit = (values: z.infer<typeof apiKeySchema>) => {
    createKey.mutate({ data: {
      provider: values.provider,
      label: values.label,
      keyValue: values.keyValue,
      baseUrl: values.baseUrl || undefined,
    } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() })
        setOpen(false)
        form.reset()
        setShowKey(false)
        toast({ title: "API key added" })
      },
      onError: (error: any) => {
        toast({ title: "Couldn't add key", description: error?.message || "Please try again.", variant: "destructive" })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setShowKey(false); } }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Add key</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 space-y-1">
          <DialogTitle className="text-[17px] font-semibold">Add API key</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground font-sans">
            Connect a model provider so Codalla can talk to it on your behalf.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-6 py-5 space-y-5">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Provider</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select a provider" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="siliconflow">SiliconFlow</SelectItem>
                        <SelectItem value="runpod">RunPod (self-hosted)</SelectItem>
                        <SelectItem value="custom">Custom (OpenAI-compatible)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Personal OpenRouter" className="bg-background border-border" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keyValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">API key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKey ? "text" : "password"}
                          placeholder="sk-…"
                          className="bg-background border-border pr-10 font-mono text-[13px]"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={showKey ? "Hide key" : "Show key"}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowKey(v => !v)}
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {showBaseUrl && (
                <FormField
                  control={form.control}
                  name="baseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">
                        {provider === "runpod" ? "RunPod pod URL" : "Base URL"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={provider === "runpod"
                            ? "https://{pod-id}-8080.proxy.runpod.net"
                            : "https://api.openai.com/v1"}
                          className="bg-background border-border font-mono text-[13px]"
                          {...field}
                        />
                      </FormControl>
                      {provider === "runpod" && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          From your RunPod pod's <span className="font-mono">Connect</span> page (port 8080). Leave the API key blank — TGI doesn't require auth.
                        </p>
                      )}
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 sm:justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={createKey.isPending}>Cancel</Button>
              <Button type="submit" disabled={createKey.isPending} className="min-w-[120px]">
                {createKey.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {createKey.isPending ? "Saving…" : "Save key"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
