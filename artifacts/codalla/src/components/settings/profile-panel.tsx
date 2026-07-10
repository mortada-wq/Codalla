import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, User as UserIcon, Github, Building2, Lock, Trash2 } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

const COMMON_TIMEZONES = [
  "UTC","Europe/London","Europe/Paris","Europe/Berlin","Europe/Istanbul","Africa/Cairo",
  "Asia/Dubai","Asia/Karachi","Asia/Kolkata","Asia/Bangkok","Asia/Shanghai","Asia/Tokyo",
  "Australia/Sydney","Pacific/Auckland","Pacific/Honolulu",
  "America/Anchorage","America/Los_Angeles","America/Denver","America/Chicago","America/New_York",
  "America/Sao_Paulo","America/Argentina/Buenos_Aires",
]

export function ProfilePanel() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()

  const [form, setForm] = useState({
    name: "",
    bio: "",
    avatarUrl: "",
    githubHandle: "",
    timezone: "UTC",
    orgName: "",
  })
  const [initial, setInitial] = useState(form)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) {
      const next = {
        name: user.name || "",
        bio: user.bio || "",
        avatarUrl: user.avatarUrl || "",
        githubHandle: user.githubHandle || "",
        timezone: user.timezone || "UTC",
        orgName: user.orgName || "",
      }
      setForm(next)
      setInitial(next)
    }
  }, [user])

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dirty || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
          githubHandle: form.githubHandle.trim() || null,
          timezone: form.timezone,
          orgName: form.orgName.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Save failed")
      }
      await refresh()
      toast({ title: "Profile updated" })
    } catch (err: any) {
      toast({ title: "Couldn't save profile", description: err?.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  const initials = (form.name || user.email).split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
  const authMethods: Array<{ label: string; badge: "info" | "purple" }> = []
  if (user.passwordHash === undefined) {
    // passwordHash isn't exposed via /auth/me; presence is inferred by absence of googleId only
  }
  // Show the auth methods we know for sure from the payload
  if (user.googleId) authMethods.push({ label: "Google", badge: "purple" })
  // Email/password is always available if a passwordHash existed at some point;
  // since we don't expose that, we display it as "Email" only if googleId is not set OR both.
  // Simplest: show both unless we're certain user is Google-only. Backend hides passwordHash;
  // for now if googleId is set we show Google; otherwise Email.
  if (!user.googleId) authMethods.unshift({ label: "Email", badge: "info" })

  return (
    <div className="space-y-6 pb-20">
      {/* ── Identity ─────────────────────────────────────────── */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" />
            Identity
          </CardTitle>
          <CardDescription>How you show up across Codalla.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/15 text-primary font-semibold text-lg flex items-center justify-center overflow-hidden shrink-0">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={form.name} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                ) : initials}
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[13px] font-medium">Avatar URL <span className="text-muted-foreground font-normal">— optional</span></label>
                <Input
                  placeholder="https://…/avatar.png"
                  className="bg-background border-border font-mono text-[13px]"
                  value={form.avatarUrl}
                  onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                  data-testid="avatar-url-input"
                />
                <p className="text-xs text-muted-foreground">Paste a public image URL. Leave blank to use your initials.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Name</label>
                <Input
                  required
                  className="bg-background border-border"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="name-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Email</label>
                <Input value={user.email} disabled className="bg-muted/50 border-border font-mono text-[13px]" />
                <p className="text-xs text-muted-foreground">Email changes aren&apos;t supported yet.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Bio <span className="text-muted-foreground font-normal">— optional</span></label>
              <Textarea
                rows={3}
                placeholder="Full-stack developer building things with AI…"
                className="bg-background border-border resize-none"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                maxLength={500}
                data-testid="bio-input"
              />
              <p className="text-xs text-muted-foreground text-right">{form.bio.length}/500</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium flex items-center gap-1.5">
                  <Github className="h-3 w-3 text-muted-foreground" />
                  GitHub handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[13px]">@</span>
                  <Input
                    placeholder="octocat"
                    className="bg-background border-border font-mono text-[13px] pl-7"
                    value={form.githubHandle}
                    onChange={(e) => setForm({ ...form, githubHandle: e.target.value.replace(/^@/, "") })}
                    data-testid="github-handle-input"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Timezone</label>
                <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sticky bar for save affordance — mirror General panel's pattern */}
            <div className="flex justify-end sticky bottom-0 z-10 -mx-6 md:-mx-8 px-6 md:px-8 py-3 -mb-6 bg-background/95 backdrop-blur border-t border-border">
              <Button type="submit" disabled={!dirty || busy} className="gap-2" data-testid="save-profile">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Organization ─────────────────────────────────────── */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Organization
          </CardTitle>
          <CardDescription>
            Group your work. Members and roles arrive with team billing (coming soon).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[13px] font-medium">Organization name <span className="text-muted-foreground font-normal">— optional</span></label>
              <Input
                placeholder="Acme Inc."
                className="bg-background border-border"
                value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                data-testid="org-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Role</label>
              <div className="flex items-center h-9">
                <Badge variant="outline" className="capitalize font-mono text-[11px]">{user.role}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Security ─────────────────────────────────────────── */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Security
          </CardTitle>
          <CardDescription>Sign-in methods and password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="text-[13px] font-medium mb-2">Sign-in methods</div>
            <div className="flex flex-wrap gap-2">
              {authMethods.map(m => (
                <Badge key={m.label} variant={m.badge} className="font-mono text-[11px]">
                  {m.label}
                </Badge>
              ))}
              <span className="text-[12px] text-muted-foreground">
                {user.googleId ? "Signed in with Google" : "Password sign-in"}
              </span>
            </div>
          </div>
          <ChangePasswordSection isGoogleUser={Boolean(user.googleId)} />
        </CardContent>
      </Card>

      {/* ── Danger zone ──────────────────────────────────────── */}
      <Card className="bg-card border-destructive/20 shadow-none">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Danger zone
          </CardTitle>
          <CardDescription>Permanently delete your account and all your data.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground mb-4">
            This will remove all your projects, API keys, custom models, conversations, and usage history.
            This action cannot be undone.
          </p>
          <DeleteAccountButton />
        </CardContent>
      </Card>
    </div>
  )
}

function ChangePasswordSection({ isGoogleUser }: { isGoogleUser: boolean }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next !== confirm) { setError("Passwords don't match"); return }
    if (next.length < 8) { setError("Password must be at least 8 characters"); return }
    setBusy(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current || undefined, newPassword: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Couldn't change password")
      }
      toast({ title: isGoogleUser ? "Password set" : "Password updated" })
      setCurrent(""); setNext(""); setConfirm(""); setOpen(false)
    } catch (err: any) {
      setError(err?.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="change-password-button">
        {isGoogleUser ? "Set a password" : "Change password"}
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-border rounded-md p-4 bg-muted/20">
      {!isGoogleUser && (
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">Current password</label>
          <Input type="password" required value={current} onChange={e => setCurrent(e.target.value)} className="bg-background border-border" />
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium">New password</label>
        <Input type="password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} className="bg-background border-border" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium">Confirm new password</label>
        <Input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} className="bg-background border-border" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(null); setCurrent(""); setNext(""); setConfirm("") }} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {busy ? "Saving…" : isGoogleUser ? "Set password" : "Update password"}
        </Button>
      </div>
    </form>
  )
}

function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState("")
  const { toast } = useToast()

  const deleteAccount = async () => {
    // Note: backend endpoint for full account deletion will come in a later iteration
    // (this button is here as a placeholder for the "danger zone" pattern).
    toast({
      title: "Account deletion",
      description: "Contact support@codalla.dev to delete your account. Self-service deletion is coming soon.",
    })
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Delete account
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes all your projects, keys, and history. Type <span className="font-mono font-semibold text-foreground">delete</span> below to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="delete" className="bg-background border-border" />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirm("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirm !== "delete"}
            onClick={deleteAccount}
            className="bg-destructive/90 hover:bg-destructive text-destructive-foreground"
          >
            Delete account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
