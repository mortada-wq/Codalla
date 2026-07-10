import { useEffect } from "react"
import { useLocation } from "wouter"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

/**
 * Wraps a page that requires authentication. Shows a spinner while checking,
 * redirects to /login if not authenticated, or renders children otherwise.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login")
    }
  }, [user, loading, setLocation])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!user) return null // useEffect will navigate
  return <>{children}</>
}
