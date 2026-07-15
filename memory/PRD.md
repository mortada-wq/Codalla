# Codalla PRD

> **Superseded in part (2026-07-15):** authentication, Google/Emergent OAuth,
> and Stripe billing were removed from scope. Codalla is a single-user
> personal tool with an implicit local user. See `PLAN.md` for the current
> roadmap; auth/billing sections below are kept as history only.

## Original problem statement
Codalla — an AI-first "vibe coding" IDE. Built on a pnpm monorepo the user provided (Express + PostgreSQL/Drizzle + React 19/Vite + IBM Plex fonts + Replit-inspired dark UI). Progressive iterations: fix popups, apply logo blue, match Replit design, add real GitHub clone, consolidate keys+usage under Settings, apply UX principles, rebuild Models page with vibe-coding pipeline, and add strong user profile + Stripe billing.

## Architecture
- **API server**: `/app/artifacts/api-server` (Express, TypeScript, esbuild bundle, port 8001)
- **Frontend**: `/app/artifacts/codalla` (Vite React 19, port 3000)
- **DB**: PostgreSQL 15 with Drizzle ORM, schema at `/app/lib/db/src/schema`
- **Ingress**: `/api/*` → 8001, `/*` → 3000 (same-origin so httpOnly cookies work)
- **Supervisor**: `/etc/supervisor/conf.d/codalla.conf` manages `codalla-api`, `codalla-web`, `postgresql`

## User personas
- **Developer (owner)**: Sets up API keys, adds custom models, chats with AI about their code, syncs with GitHub.
- **Future: team member**: A collaborator invited to an org (schema ready, feature deferred).

## Core requirements (static)
1. Authentication with **both** email/password (JWT httpOnly cookies) **and** Emergent-managed Google Auth
2. Full user profile: email, name, avatar, bio, GitHub handle, timezone, org name, role
3. All data (projects, keys, models, usage, conversations, settings) scoped per user
4. Replit-style UI (IBM Plex Sans + Mono, `#0E1525` navy palette, 6px radius)
5. Logo blue `#3B92B5` as primary accent
6. Real GitHub clone on project creation (public + private via PAT)
7. Hybrid Stripe billing: monthly plans + credit top-ups (PENDING — Phase 2)

## What's been implemented (2026-07-09)
### Session 1 — Setup + design polish
- Installed pnpm workspace, PostgreSQL 15, pushed Drizzle schema
- Built api-server with esbuild, wired supervisor for `codalla-api` + `codalla-web` + `postgresql`
- Fixed dialog centering bug (`translate-y-[50%]` → `-50%`)
- Replaced primary color with logo blue `#3B92B5`
- Rewrote index.css to match Replit: IBM Plex fonts, `#0E1525` bg, `#1C2333` cards, `#2B3245` borders, 6px radius, 14px base font

### Session 2 — GitHub clone
- Backend `POST /api/projects` now clones the repo when `gitRemoteUrl` is provided
- Reads token priority: request body → `settings.githubToken` → none
- Actionable error for private-repo-without-token
- Rollback on clone failure (no orphan projects)

### Session 3 — UX principles pass
- Dashboard rewrite: progressive disclosure in Create Project dialog (Story/Target behind "Add context to help the AI" collapsible), dynamic submit label ("Create & clone repository" / "Cloning repository…"), AlertDialog for destructive actions, keyboard-accessible project cards, empty state with clear CTA

### Session 4 — Consolidated Settings
- Removed Usage and API Keys from sidebar; both moved into Settings as tabs
- New `Tabs`-based Settings page with `?tab=` URL sync
- Split into panels: `general-panel.tsx`, `api-keys-panel.tsx`, `usage-panel.tsx`
- Legacy `/keys` and `/usage` routes redirect

### Session 5 — Models page (vibe-coding pipeline)
- Full rewrite with 5-stage pipeline: context dump → scaffolding → vibe checks → frictionless logic → edge cases
- Built-in models section + user's custom models
- Real-time validation, smart defaults per provider, duplicate detection, live preview, optimistic toggle, offline banner, retry on fetch fail, form state preserved on save fail, click-to-copy IDs

### Session 6 — Auth foundation + Profile (Phase 1)
- Extended Drizzle schema: `users`, `login_attempts`, `password_reset_tokens`; added `userId` FK to all data tables; `settings` keyed by userId
- **Wiped DB fresh start** — all previous test data cleared
- Backend: `/api/auth/{register,login,logout,me,refresh,google/session,profile,change-password,forgot-password,reset-password}`
- Password hashing with bcryptjs, JWT (access 15m + refresh 7d) in httpOnly SameSite=Lax cookies, brute-force lockout (5 attempts / 15min)
- `requireAuth` middleware applied to all data routes
- All routes updated to scope by `req.user!.id` — projects, keys, usage, custom models, settings, conversations, criteria, memory, filesystem, github, AI
- Frontend `AuthProvider` context with `useAuth()` hook, `ProtectedRoute` wrapper, `/login` + `/register` (unified `AuthPage` component with `mode` prop), `/forgot-password`, `AuthCallback` (`#session_id=` handling with useRef guard)
- Two-panel login page: brand story on left, form on right; Google button up-top, email/password below
- User menu in sidebar rail (avatar with initials fallback → dropdown with Profile/Settings/Sign out)
- Profile settings tab: Identity (avatar/name/email/bio/GitHub/timezone), Organization (name/role badge), Security (sign-in methods + Change password), Danger zone

## Prioritized backlog

### P0 — Phase 2 (Stripe billing)
- User will provide their own Stripe test/live keys — **BLOCKING**
- 3 subscription plans (Free / Pro / Team) with monthly credit allowances
- Credit ledger table + monthly reset job
- Stripe Checkout for plan upgrades + credit top-ups
- Customer Portal iframe/redirect for self-service
- Webhook handler for `customer.subscription.*`, `checkout.session.completed`, `invoice.paid`, `payment_intent.succeeded`
- Show "credits remaining" in dashboard + throttle AI calls when depleted

### P1 — Auth polish
- Full account deletion endpoint (currently placeholder in Danger zone)
- Email verification flow (users have `emailVerified` field but it's not enforced)
- Email delivery for password reset (currently just logs the link to server console)
- Session revocation (currently JWT-based only, no server-side revoke list)

### P2 — Team/collab
- Multi-user orgs (schema has `orgName` + `role` fields; UI for inviting members)
- Project sharing across org members
- Per-org billing (once single-user Stripe works)

## Next tasks
1. Ask user for Stripe test keys (publishable + secret + webhook signing secret)
2. Add `stripe` npm SDK to api-server
3. Extend Drizzle schema: `subscriptions`, `credit_ledger`, `payment_transactions`
4. Implement webhook handler + Customer Portal + plan tiers
5. Wire "Billing" tab into Settings, show credit balance in nav rail
