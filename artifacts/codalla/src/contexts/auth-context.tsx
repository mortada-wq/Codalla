import React, { createContext, useCallback, useContext, useEffect, useState } from "react"

export interface AuthUser {
  id: string
  email: string
  googleId: string | null
  name: string
  avatarUrl: string | null
  bio: string | null
  githubHandle: string | null
  timezone: string
  orgName: string | null
  role: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  register: (email: string, password: string, name: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (u: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Wrap a fetch call so cookies are always included and errors surface a clean message
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null as any
  return res.json()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const u = await api<AuthUser>("/api/auth/me")
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Skip the /me check if we're returning from an OAuth callback —
    // the AuthCallback component will exchange the session_id first.
    if (typeof window !== "undefined" && window.location.hash.includes("session_id=")) {
      setLoading(false)
      return
    }
    refresh()
  }, [refresh])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const u = await api<AuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    })
    setUser(u)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await api<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    setUser(u)
  }, [])

  const loginWithGoogle = useCallback(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS — THIS BREAKS THE AUTH
    const redirectUrl = `${window.location.origin}/`
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`
  }, [])

  const logout = useCallback(async () => {
    try { await api("/api/auth/logout", { method: "POST" }) } catch {/* ignore */}
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, register, login, loginWithGoogle, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
