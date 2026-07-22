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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch the implicit local user
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u)
        } else {
          setUser({
            id: "local",
            email: "local@codalla.local",
            name: "Local User",
            avatarUrl: null,
          })
        }
      })
      .catch(() => {
        setUser({
          id: "local",
          email: "local@codalla.local",
          name: "Local User",
          avatarUrl: null,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

