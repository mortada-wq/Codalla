import { useState } from "react"
import { useLocation } from "wouter"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CodallaLogo } from "@/components/logo"
import { Loader2, ArrowLeft, CheckCircle2, Mail, AlertCircle } from "lucide-react"
import { Link } from "wouter"

export function ForgotPasswordPage() {
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error("Something went wrong. Please try again.")
      setSent(true)
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm space-y-6">
        <button onClick={() => setLocation("/login")} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" />
          Back to sign in
        </button>

        <CodallaLogo className="h-7 w-auto" />

        {sent ? (
          <div className="space-y-3">
            <div className="p-3 rounded-full bg-success/10 inline-flex">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <h1 className="text-[22px] font-semibold">Check your inbox</h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent
              a link to reset your password. It expires in 1 hour.
            </p>
            <p className="text-[12px] text-muted-foreground">
              Didn&apos;t get anything? Check your spam folder, or{" "}
              <button className="text-primary hover:underline" onClick={() => setSent(false)}>try a different email</button>.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <h1 className="text-[22px] font-semibold">Reset your password</h1>
              <p className="text-[13px] text-muted-foreground">
                Enter your email — we&apos;ll send you a link to set a new password.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input id="email" type="email" required placeholder="you@company.com" className="pl-9 bg-card border-border" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-[12px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {busy ? "Sending…" : "Send reset link"}
              </Button>

              <p className="text-[13px] text-muted-foreground text-center">
                Remembered it? <Link href="/login" className="text-primary hover:underline font-medium">Back to sign in</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
