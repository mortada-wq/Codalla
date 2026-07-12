import { useState } from "react"
import { useLocation, Link } from "wouter"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CodallaLogo } from "@/components/logo"
import { Loader2, AlertCircle, Mail, Lock, User } from "lucide-react"

type Mode = "login" | "register"

interface AuthPageProps { mode: Mode }

export function AuthPage({ mode }: AuthPageProps) {
  const [, setLocation] = useLocation()
  const { login, register } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isRegister = mode === "register"

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (isRegister) {
        await register(email, password, name)
      } else {
        await login(email, password)
      }
      setLocation("/")
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">

      {/* ── Brand side ────────────────────────────────────────────── */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-sidebar border-r border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <CodallaLogo className="h-8 w-auto" />
          <div className="max-w-md space-y-4">
            <h2 className="type-display text-foreground leading-tight">
              Vibe-code with AI, in a workspace that ships.
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              Codalla is a coding-first IDE for developers who direct AI instead of typing every
              character. Bring your own models, your own repos, your own vibe.
            </p>
            <ul className="space-y-2 text-[13px] text-muted-foreground pt-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                Real-time AI chat with your code as context
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                Clone from GitHub in one click
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                Bring OpenRouter, SiliconFlow, or your own RunPod
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground font-mono">© 2026 · Codalla</p>
        </div>
      </div>

      {/* ── Form side ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex justify-center">
            <CodallaLogo className="h-8 w-auto" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-[22px] font-semibold text-foreground">
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {isRegister
                ? "Start coding with AI in seconds."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          {/* ── Email form ────────────────────────────────────── */}
          <form onSubmit={onSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" htmlFor="name">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Ada Lovelace"
                    className="pl-9 bg-card border-border"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="name-input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className="pl-9 bg-card border-border"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="email-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium" htmlFor="password">Password</label>
                {!isRegister && (
                  <Link href="/forgot-password" className="text-[12px] text-primary hover:underline">
                    Forgot?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  minLength={isRegister ? 8 : undefined}
                  placeholder={isRegister ? "8+ characters" : "••••••••"}
                  className="pl-9 bg-card border-border"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="password-input"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-[12px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy} data-testid="submit-button">
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {busy
                ? (isRegister ? "Creating account…" : "Signing in…")
                : (isRegister ? "Create account" : "Sign in")}
            </Button>
          </form>

          <p className="text-[13px] text-muted-foreground text-center">
            {isRegister ? "Already have an account? " : "No account yet? "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="text-primary hover:underline font-medium"
              data-testid={isRegister ? "switch-to-login" : "switch-to-register"}
            >
              {isRegister ? "Sign in" : "Create one"}
            </Link>
          </p>

          <p className="text-[11px] text-muted-foreground/80 text-center pt-2 leading-relaxed">
            By {isRegister ? "creating an account" : "signing in"}, you agree to our{" "}
            <Link href="/terms" className="hover:text-foreground underline underline-offset-2">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

