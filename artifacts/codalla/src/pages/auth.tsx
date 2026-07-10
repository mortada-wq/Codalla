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
  const { login, register, loginWithGoogle } = useAuth()
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

          {/* ── Google button (top for prominence) ─────────────── */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={loginWithGoogle}
            className="w-full gap-2.5 bg-card hover:bg-accent border-border"
            data-testid="google-signin-button"
          >
            <GoogleGlyph className="h-4 w-4" />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">or with email</span>
            <div className="h-px flex-1 bg-border" />
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

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.85 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.67-2.83z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.67 2.83C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
    </svg>
  )
}
