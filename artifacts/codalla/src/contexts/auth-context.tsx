import { createContext, useContext, useEffect, useState } from "react"

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch the implicit local user
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setUser(u || { id: "local", email: "local@codalla.local", name: "Local User", avatarUrl: null }))
      .catch(() => setUser({ id: "local", email: "local@codalla.local", name: "Local User", avatarUrl: null }))
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    // No-op in no-auth mode
    console.log("Logout called (no-op)")
  }

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

