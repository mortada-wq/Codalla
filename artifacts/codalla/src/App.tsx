import { Switch, Route, Router as WouterRouter, Redirect } from "wouter"
import Dashboard from "./pages/dashboard"
import EditorPage from "./pages/editor"
import SettingsPage from "./pages/settings"
import ModelsPage from "./pages/models"
import NotFound from "./pages/not-found"
import TermsPage from "./pages/terms"
import PrivacyPage from "./pages/privacy"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
    },
  },
})

function AppRouter() {
  return (
    <Switch>
      {/* ── Legal documents ────────────────────────────────────────── */}
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      {/* ── App routes ─────────────────────────────────────────────── */}
      <Route path="/" component={Dashboard} />
      <Route path="/editor/:projectId" component={EditorPage} />
      <Route path="/keys">{() => <Redirect to="/settings?tab=keys" />}</Route>
      <Route path="/usage">{() => <Redirect to="/settings?tab=usage" />}</Route>
      <Route path="/settings" component={SettingsPage} />
      <Route path="/models" component={ModelsPage} />
      <Route><NotFound /></Route>
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
