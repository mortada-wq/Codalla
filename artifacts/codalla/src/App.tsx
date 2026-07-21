import { Switch, Route, Router as WouterRouter, Redirect } from "wouter"
import Dashboard from "./pages/dashboard"
import EditorPage from "./pages/editor"
import SettingsPage from "./pages/settings"
import ModelsPage from "./pages/models"
import WorkflowsPage from "./pages/workflows"
import NotFound from "./pages/not-found"
import TermsPage from "./pages/terms"
import PrivacyPage from "./pages/privacy"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // A 401 won't fix itself by retrying — the user needs to sign in
        if (error?.status === 401 || error?.status === 403) return false
        return failureCount < 2
      },
    },
  },
})

function AppRouter() {
  return (
    <Switch>
      {/* ── Public routes ──────────────────────────────────────────── */}
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      {/* ── App routes (no auth required) ─────────────────────────────────── */}
      <Route path="/">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/editor/:projectId">
        <ProtectedRoute><EditorPage /></ProtectedRoute>
      </Route>
      <Route path="/keys">{() => <Redirect to="/settings?tab=keys" />}</Route>
      <Route path="/usage">{() => <Redirect to="/settings?tab=usage" />}</Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/models">
        <ProtectedRoute><ModelsPage /></ProtectedRoute>
      </Route>
      <Route path="/workflows">
        <ProtectedRoute><WorkflowsPage /></ProtectedRoute>
      </Route>
      <Route><NotFound /></Route>
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App

