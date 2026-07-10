import { useEffect, useRef } from "react"
import { useGetSettings, useUpdateSettings, useListModels, getGetSettingsQueryKey } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Github, Cpu, LayoutTemplate, Save, Server, Loader2 } from "lucide-react"

const settingsSchema = z.object({
  defaultModelId: z.string().min(1),
  defaultProvider: z.string().min(1),
  theme: z.enum(["dark", "light", "high-contrast"]),
  fontSize: z.coerce.number().min(8).max(32),
  tabSize: z.coerce.number().min(2).max(8),
  wordWrap: z.boolean(),
  minimap: z.boolean(),
  sendContextWithMessages: z.boolean(),
  githubToken: z.string().optional().or(z.literal("")),
  runpodEndpoint: z.string().optional().or(z.literal("")),
})

export function GeneralSettingsPanel() {
  const { data: settings, isLoading } = useGetSettings()
  const { data: models } = useListModels()
  const updateSettings = useUpdateSettings()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultModelId: "",
      defaultProvider: "",
      theme: "dark",
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      minimap: true,
      sendContextWithMessages: true,
      githubToken: "",
      runpodEndpoint: "",
    },
  })

  const modelsByProvider = models?.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, typeof models>) || {}

  const initialized = useRef(false)
  useEffect(() => {
    if (settings && !initialized.current) {
      form.reset({
        defaultModelId: settings.defaultModelId,
        defaultProvider: settings.defaultProvider,
        theme: settings.theme,
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap,
        minimap: settings.minimap ?? true,
        sendContextWithMessages: settings.sendContextWithMessages ?? true,
        githubToken: settings.githubToken || "",
        runpodEndpoint: (settings as any).runpodEndpoint || "",
      })
      initialized.current = true
    }
  }, [settings, form])

  const selectedModelId = form.watch("defaultModelId")
  useEffect(() => {
    if (selectedModelId && models) {
      const model = models.find(m => m.id === selectedModelId)
      if (model && model.provider !== form.getValues("defaultProvider")) {
        form.setValue("defaultProvider", model.provider)
      }
    }
  }, [selectedModelId, models, form])

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    updateSettings.mutate({ data: values as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() })
        toast({ title: "Settings saved" })
        if (values.theme) {
          document.documentElement.classList.remove('dark', 'light', 'high-contrast')
          document.documentElement.classList.add(values.theme)
        }
      },
      onError: (err: any) => {
        toast({ title: "Couldn't save settings", description: err?.message, variant: "destructive" })
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="bg-card border-border shadow-none">
            <CardHeader>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 mt-2" />
            </CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-20">

        {/* ── AI Assistant Defaults ─────────────────────────────── */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              AI assistant defaults
            </CardTitle>
            <CardDescription>Default models used across the application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="defaultModelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px] font-medium">Default model</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                        <div key={provider}>
                          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground bg-muted/30 tracking-wider">
                            {provider}
                          </div>
                          {providerModels.map(model => (
                            <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">Selected by default for new conversations.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sendContextWithMessages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4 bg-background">
                  <div className="space-y-0.5">
                    <FormLabel className="text-[13px] font-medium">Include file context</FormLabel>
                    <FormDescription className="text-xs">
                      Automatically send the currently open file when chatting with AI.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Editor Preferences ───────────────────────────────── */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              Editor preferences
            </CardTitle>
            <CardDescription>Customize the code editor experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Theme</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dark">Dark (default)</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="high-contrast">High contrast</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fontSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Font size (px)</FormLabel>
                    <FormControl>
                      <Input type="number" min={8} max={32} className="bg-background border-border" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tabSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Tab size</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="2">2 spaces</SelectItem>
                        <SelectItem value="4">4 spaces</SelectItem>
                        <SelectItem value="8">8 spaces</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <FormField
                control={form.control}
                name="wordWrap"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4 bg-background">
                    <div className="space-y-0.5">
                      <FormLabel className="text-[13px] font-medium">Word wrap</FormLabel>
                      <FormDescription className="text-xs">Wrap lines that exceed the editor width.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimap"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4 bg-background">
                    <div className="space-y-0.5">
                      <FormLabel className="text-[13px] font-medium">Show minimap</FormLabel>
                      <FormDescription className="text-xs">Display the code minimap on the right side of the editor.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── GitHub ───────────────────────────────────────────── */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <Github className="h-4 w-4 text-primary" />
              GitHub
            </CardTitle>
            <CardDescription>Connect your GitHub account for repository operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="githubToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px] font-medium">Personal access token</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="ghp_..." className="bg-background border-border font-mono text-[13px]" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Required for cloning private repositories and pushing commits.{" "}
                    <a
                      href="https://github.com/settings/tokens/new?description=Codalla&scopes=repo"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Generate one →
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── RunPod ───────────────────────────────────────────── */}
        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              RunPod
            </CardTitle>
            <CardDescription>Self-hosted model endpoint.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="runpodEndpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px] font-medium">Pod endpoint URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://{pod-id}-8080.proxy.runpod.net" className="bg-background border-border font-mono text-[13px]" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    The public URL for your RunPod pod (port 8080). Add a RunPod entry in <span className="text-foreground">API keys</span> with any placeholder value to activate.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Sticky save bar ──────────────────────────────────── */}
        <div className="flex justify-end sticky bottom-0 z-10 -mx-6 md:-mx-10 px-6 md:px-10 py-4 bg-background/95 backdrop-blur border-t border-border">
          <Button type="submit" disabled={updateSettings.isPending} className="gap-2">
            {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {updateSettings.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>

      </form>
    </Form>
  )
}
