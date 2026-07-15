import * as React from "react"
import { useLocation } from "wouter"
import { Home, Settings, Blocks, LogOut } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
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

function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) return null

  const initials = (user.name || user.email).split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="user-menu-trigger"
          className="relative h-9 w-9 rounded-full overflow-hidden bg-primary/15 text-primary font-semibold text-[11px] flex items-center justify-center hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
          aria-label="Open user menu"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
          ) : initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56 ml-2">
        <DropdownMenuLabel className="pb-2">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold truncate">{user.name}</span>
            <span className="text-[11px] font-normal text-muted-foreground truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="text-[13px] cursor-pointer text-destructive focus:text-destructive"
          data-testid="user-menu-logout"
        >
          <LogOut className="h-3.5 w-3.5 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
          <UserMenu />
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 h-full relative overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
