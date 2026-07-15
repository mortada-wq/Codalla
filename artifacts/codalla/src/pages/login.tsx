import { Redirect } from "wouter"
import { FcGoogle } from "react-icons/fc"
import { CodallaLogo } from "@/components/logo"
import { useAuth } from "@/contexts/auth-context"

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That Google account isn't on the team allowlist. Ask your admin to add your email or domain.",
  oauth_failed: "Google sign-in didn't complete. Please try again.",
}

export function LoginPage() {
  const { user, loading } = useAuth()
  const error = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("error")
    : null

  if (!loading && user) return <Redirect to="/" />

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground font-sans px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <CodallaLogo className="h-9 w-auto" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            Your team's AI coding workspace
          </p>
        </div>

        <div className="mt-10 rounded-md border border-border bg-card p-6">
          {error && (
            <p className="mb-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive" data-testid="login-error">
              {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
            </p>
          )}
          <a
            href="/api/auth/google"
            data-testid="google-signin"
            className="flex w-full items-center justify-center gap-2.5 rounded-sm border border-border bg-background px-4 py-2.5 text-[14px] font-medium hover:bg-muted/60 transition-colors"
          >
            <FcGoogle className="h-4.5 w-4.5" />
            Continue with Google
          </a>
          <p className="mt-4 text-center text-[12px] text-muted-foreground">
            Use your Google account to continue.
          </p>
        </div>
      </div>
    </div>
  )
}
