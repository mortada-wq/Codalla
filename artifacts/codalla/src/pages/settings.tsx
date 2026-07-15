import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { Layout } from "@/components/layout"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Settings2, Key, Activity } from "lucide-react"
import { GeneralSettingsPanel } from "@/components/settings/general-panel"
import { ApiKeysPanel } from "@/components/settings/api-keys-panel"
import { UsagePanel } from "@/components/settings/usage-panel"

type TabId = "general" | "keys" | "usage"

const VALID_TABS: TabId[] = ["general", "keys", "usage"]

function parseTabFromUrl(): TabId {
  if (typeof window === "undefined") return "general"
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab") as TabId | null
  return tab && VALID_TABS.includes(tab) ? tab : "general"
}

export default function SettingsPage() {
  const [location, setLocation] = useLocation()
  const [tab, setTab] = useState<TabId>(parseTabFromUrl)

  // Keep the URL in sync so tabs are shareable / linkable
  useEffect(() => {
    const nextUrl = tab === "general" ? "/settings" : `/settings?tab=${tab}`
    if (typeof window !== "undefined" && `${location}${window.location.search}` !== nextUrl) {
      setLocation(nextUrl, { replace: true })
    }
  }, [tab, location, setLocation])

  // Handle back/forward browser buttons
  useEffect(() => {
    const onPopState = () => setTab(parseTabFromUrl())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl mx-auto px-6 py-10 md:px-10 md:py-12 space-y-8">

          {/* ── Page header ────────────────────────────────────────── */}
          <div>
            <h1 className="type-display text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1 text-[13px]">
              Preferences, API keys, and usage — everything about your Codalla workspace.
            </p>
          </div>

          {/* ── Tabbed body ────────────────────────────────────────── */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-6">
            <TabsList className="border-b border-border w-full justify-start rounded-none h-auto p-0 gap-6">
              <TabsTrigger
                value="general"
                className="!font-sans !text-[13px] !px-0 !py-3 h-auto data-[state=active]:font-semibold gap-2"
              >
                <Settings2 className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger
                value="keys"
                className="!font-sans !text-[13px] !px-0 !py-3 h-auto data-[state=active]:font-semibold gap-2"
              >
                <Key className="h-3.5 w-3.5" />
                API keys
              </TabsTrigger>
              <TabsTrigger
                value="usage"
                className="!font-sans !text-[13px] !px-0 !py-3 h-auto data-[state=active]:font-semibold gap-2"
              >
                <Activity className="h-3.5 w-3.5" />
                Usage & costs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6">
              <GeneralSettingsPanel />
            </TabsContent>
            <TabsContent value="keys" className="mt-6">
              <ApiKeysPanel />
            </TabsContent>
            <TabsContent value="usage" className="mt-6">
              <UsagePanel />
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </Layout>
  )
}
