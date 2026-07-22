import { Switch, Route, Router as WouterRouter } from "wouter"
import { Suspense, lazy } from "react"
import Dashboard from "./pages/dashboard"
import NotFound from "./pages/not-found"
import TermsPage from "./pages/terms"
import PrivacyPage from "./pages/privacy"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"

// Code-split: the editor pulls in Monaco (and, via Settings, Recharts) —
// both sizable — so only a visit to these routes pays for loading them.
const EditorPage = lazy(() => import("./pages/editor"))
const SettingsPage = lazy(() => import("./pages/settings"))
const ModelsPage = lazy(() => import("./pages/models"))
const WorkflowsPage = lazy(() => import("./pages/workflows"))

function RouteFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
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
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}><EditorPage /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}><SettingsPage /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/models">
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}><ModelsPage /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/workflows">
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}><WorkflowsPage /></Suspense>
        </ProtectedRoute>
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

