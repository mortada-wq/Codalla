import { useEffect, useState } from "react"
import { Link, useLocation } from "wouter"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { CodallaLogo } from "@/components/logo"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

interface Section {
  id: string
  label: string
}

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  sections: Section[]
  children: React.ReactNode
}

/**
 * Shared layout for long-form legal documents (Terms, Privacy).
 *   • Two-column: sticky TOC on the left, prose on the right
 *   • Scroll-spy highlights the currently visible section
 *   • Header adapts to auth state (Back to app vs Sign in)
 *   • Footer with cross-links between documents
 */
export function LegalPageLayout({ title, lastUpdated, sections, children }: LegalPageLayoutProps) {
  const { user } = useAuth()
  const [, setLocation] = useLocation()
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" data-testid="header-home">
            <CodallaLogo className="h-6 w-auto" />
          </Link>
          <nav className="flex items-center gap-6 text-[13px]">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            {user ? (
              <button onClick={() => setLocation("/")} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors font-medium">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to app
              </button>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                Sign in
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-20">
        <div className="max-w-4xl">
          <p className="text-[13px] text-muted-foreground font-mono uppercase tracking-[0.15em]">Codalla</p>
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground mt-2 tracking-tight">{title}</h1>
          <p className="mt-3 text-[13px] text-muted-foreground">Last updated · {lastUpdated}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-10 md:gap-16 mt-12">
          {/* ── TOC ─────────────────────────────────────────────── */}
          <aside className="md:sticky md:top-24 md:self-start">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">On this page</p>
            <nav className="space-y-0.5 text-[13px]">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    "block py-1 pl-3 border-l-2 transition-colors",
                    activeId === s.id
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* ── Prose ───────────────────────────────────────────── */}
          <div className="prose-doc">
            {children}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 flex flex-col md:flex-row justify-between items-start gap-6 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <CodallaLogo className="h-5 w-auto" />
            <span className="font-mono text-xs">© 2026 Codalla</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <a href="mailto:legal@codalla.dev" className="hover:text-foreground transition-colors">legal@codalla.dev</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
