import * as React from "react"
import { useLocation } from "wouter"
import { Home, Settings, Blocks } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CodallaMark } from "@/components/logo"

interface LayoutProps {
  children: React.ReactNode
}

function SidebarItem({ icon: Icon, href, label }: { icon: React.ElementType; href: string; label: string }) {
  const [location, setLocation] = useLocation()
  const isActive = location === href || (href !== "/" && location.startsWith(href))

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          onClick={() => setLocation(href)}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-sm transition-all duration-100",
            isActive
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
          )}
        >
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />}
          <Icon className="h-[18px] w-[18px]" />
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-mono text-xs px-2 py-1">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* ── Icon rail ──────────────────────────────────────────────────── */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-border/50 bg-sidebar py-3 z-50">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-9 w-9 items-center justify-center mb-2">
            <CodallaMark className="h-6 w-auto" />
          </div>
          <div className="w-6 h-px bg-border/50 mb-2" />
          <SidebarItem icon={Home} href="/" label="Dashboard" />
          <SidebarItem icon={Blocks} href="/models" label="Models" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <SidebarItem icon={Settings} href="/settings" label="Settings" />
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 h-full relative overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
