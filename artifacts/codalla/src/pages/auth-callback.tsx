import { useEffect, useRef, useState } from "react"
import { useLocation } from "wouter"
import { useAuth, type AuthUser } from "@/contexts/auth-context"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * AuthCallback — runs when Emergent OAuth redirects back to us with #session_id=...
 * Exchanges the temporary session_id for a Codalla JWT cookie, then routes to /.
 * Uses useRef so React 18 StrictMode's double-invoke doesn't fire the exchange twice.
 */
export function AuthCallback() {
  const [, setLocation] = useLocation()
  const { setUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (hasProcessed.current) return
    hasProcessed.current = true

    const hash = window.location.hash
    const match = hash.match(/session_id=([^&]+)/)
    if (!match) {
      setError("No session_id in URL. Please try signing in again.")
      return
    }
    const sessionId = decodeURIComponent(match[1])

    ;(async () => {
      try {
        const res = await fetch("/api/auth/google/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || `Sign-in failed (${res.status})`)
        }
        const user: AuthUser = await res.json()
        setUser(user)
        // Clean the URL fragment before navigating away
        history.replaceState(null, "", "/")
        setLocation("/")
      } catch (e: any) {
        setError(e?.message ?? "Sign-in failed. Please try again.")
      }
    })()
  }, [setUser, setLocation])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center max-w-sm px-6">
        {error ? (
          <>
            <div className="p-3 rounded-full bg-destructive/10 inline-flex mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-[15px] font-semibold">Sign-in failed</p>
            <p className="text-[13px] text-muted-foreground mt-1.5">{error}</p>
            <Button onClick={() => setLocation("/login")} className="mt-5">
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-[15px] font-semibold">Signing you in…</p>
            <p className="text-[13px] text-muted-foreground mt-1.5">Verifying your Google session.</p>
          </>
        )}
      </div>
    </div>
  )
}
