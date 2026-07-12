import { Switch, Route, Router as WouterRouter, Redirect } from "wouter"
import { useEffect } from "react"
import { useLocation } from "wouter"
import Dashboard from "./pages/dashboard"
import EditorPage from "./pages/editor"
import SettingsPage from "./pages/settings"
import ModelsPage from "./pages/models"
import NotFound from "./pages/not-found"
import { AuthPage } from "./pages/auth"
import { ForgotPasswordPage } from "./pages/forgot-password"
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
        // Don't retry auth errors — the user's not going to become authorized by retrying
        if (error?.status === 401 || error?.status === 403) return false
        return failureCount < 2
      },
    },
  },
})

function AppRouter() {
  return (
    <Switch>
      {/* ── Public auth routes ─────────────────────────────────────── */}
      <Route path="/login">{() => <AuthPage mode="login" />}</Route>
      <Route path="/register">{() => <AuthPage mode="register" />}</Route>
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      {/* ── Public legal documents ─────────────────────────────────── */}
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      {/* ── Protected app routes ──────────────────────────────────── */}
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
