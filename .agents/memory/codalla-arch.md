---
name: Codalla platform architecture
description: Stack, structure, and key technical decisions for the Codalla AI coding IDE.
---

## Stack
- **Frontend**: React + Vite, Tailwind, shadcn/ui, Monaco editor (self-hosted via `loader.config`, not the CDN default — see vite.config.ts's `optimizeDeps.exclude`), wouter router, @tanstack/react-query, Orval-generated API hooks
- **Backend**: Express (artifacts/api-server), Zod validation from generated @workspace/api-zod
- **Database**: PostgreSQL via Drizzle ORM (lib/db) — required, no SQLite/in-memory fallback
- **AI**: openai npm package pointed at SiliconFlow / OpenRouter / RunPod / custom base URLs
- **No authentication** — every request is attributed to one implicit `local` user (`middleware/auth.ts`). See `PLAN.md` for what this means for deployment.

## Key files
- `lib/api-spec/openapi.yaml` — source of truth for API shape for the routes it covers; run `pnpm --filter @workspace/api-spec run codegen` after any change. Several newer route files (ai-actions.ts, workflows.ts) are hand-rolled and not fully represented in the spec — check the route file itself, not just the spec, before assuming an endpoint doesn't exist.
- `lib/db/src/schema/index.ts` — 14 tables: users, workflows, projects, projectAssets, projectSuccessCriteria, projectMemoryNotes, apiKeys, conversations, messages, usageLog, customModels, patterns, patternUsageLog, settings. Hot-path columns (userId, conversationId, projectId, etc.) have explicit indexes — add one for any new FK you introduce.
- `artifacts/api-server/src/routes/` — 14 resource route files: health, auth (stub — no-op /auth/me and /auth/logout), projects, filesystem, github, ai, ai-actions, apikeys, usage, settings, models, criteria, memory, workflows, patterns.
- `artifacts/codalla/src/pages/` — 8 pages: dashboard, editor/:projectId, models, settings, workflows, terms, privacy, not-found. All except dashboard/terms/privacy/not-found are lazy-loaded in App.tsx (Monaco and Recharts are large — don't make them eagerly imported again).

## Post-merge checklist (always run after task merges)
1. `pnpm --filter @workspace/api-spec run codegen` — regenerates api-zod + api-client-react, then dedupes both `src/index.ts` barrel files automatically (see below — don't skip this by running orval directly)
2. `pnpm --filter @workspace/db run push` — applies schema changes to DB
3. `pnpm --filter @workspace/api-server run typecheck && pnpm --filter @workspace/codalla run typecheck`

## Codegen barrel-file duplication (fixed, but know why)
- `orval` appends its re-export lines to `lib/api-client-react/src/index.ts` and `lib/api-zod/src/index.ts` on every run instead of replacing them — `clean: true` in `orval.config.ts` only cleans the `generated/` subfolder, not these hand-maintained barrel files sitting next to it.
- Fixed via `lib/api-spec/dedupe-index.mjs`, wired into the `codegen` npm script (`orval ... && node ./dedupe-index.mjs && ...`). It normalizes quote style before comparing lines, since orval's re-appended lines use different quotes than hand-written ones and a naive string dedup misses that.
- If you ever run `orval` directly instead of `pnpm run codegen`, you will reintroduce duplicates — always use the npm script.

## AI chat system prompt (context-aware)
- `artifacts/api-server/src/utils/detect-stack.ts` — reads project localPath to detect tech stack
- Path guard: only reads paths under `codalla-projects/` or `projects/` — never arbitrary FS paths
- `getAutoSystemPrompt(projectId)` in ai.ts — fetches project+criteria+memory, builds tailored prompt
- Both `/ai/chat` and `/ai/chat/stream` always inject the auto prompt; frontend `systemPrompt` layers on top
- Streaming chat sets `stream_options: { include_usage: true }` — without it most OpenAI-compatible providers omit `usage` from every chunk and cost/token accounting silently records 0.
- Cost calc (`logUsage` in ai.ts, duplicated in ai-actions.ts and workflow-execution's replacement — see below) checks `customModelsTable` for the model's real configured pricing first, falling back to a small hardcoded built-in-model rate table. Conversation `totalCost` updates are atomic SQL increments (`sql\`${col} + ${cost}\``), not read-then-write — needed to avoid a lost-update race across concurrent requests.

## Important: zod in api-server routes
- api-server does NOT have zod as a direct dependency (removed — it was never imported despite being listed)
- Do NOT `import { z } from "zod"` or `"zod/v4"` in route files — use manual validation or `@workspace/api-zod`

## AI chat streaming
- SSE endpoint at `POST /api/ai/chat/stream` (not in OpenAPI spec — raw route)
- Frontend uses native fetch + ReadableStream + AbortController; server handles `req.on('close')`
- Frontend `ChatView` is keyed by `conversationId` — switching conversations fully remounts it, which both aborts the in-flight stream (effect cleanup) and stops a running workflow's step loop (a mount-scoped effect sets a cancel ref on unmount) from continuing to post into the conversation you just left.
- The Send button becomes a stop control (aborts the fetch) while a reply is streaming.

## Custom models
- `customModelsTable` in DB, CRUD at `/api/models/custom` (not in OpenAPI spec — raw Express routes)
- Frontend at `/models` — useEffect-based fetch hook
- `pricingPrompt`/`pricingCompletion` are $/1M-tokens, used by `logUsage` for real cost accounting — see above

## Patterns (built-in pattern library)
- `patternsTable`: `userId = null` means built-in, non-null means a team-owned custom pattern
- Seed built-ins with `pnpm --filter @workspace/db run seed` (`lib/db/src/seed.ts`) — idempotent by pattern `id`, safe to re-run after editing the seed list
- `GET /patterns`, `GET /patterns/:id`, and `POST /patterns/suggest` all scope to `isNull(userId) OR eq(userId, req.user.id)` — don't drop that filter when touching these routes, it's the only thing preventing one account's custom patterns from being visible to every other account on a shared instance
- Frontend calls `/patterns/suggest` after every chat turn (editor.tsx) and renders a "Suggested Patterns" panel — this is the only consumer

## What's NOT wired up (don't assume otherwise)
- `artifacts/api-server/src/routes/github.ts` implements a full git surface (status/diff/commit+push/pull/branches/checkout) but the frontend never calls any of it beyond initial clone-on-create — there's no git panel in the editor.
- The AI "Apply" flow (chat file-blocks and code-actions) only writes to in-memory editor state via a diff-confirm dialog; Ctrl+S is still required to persist to disk, and nothing runs `git commit` automatically.

## Logo
- SVG logo component at `artifacts/codalla/src/components/logo.tsx` — gradient `#4C5673 → #90A2D9 → #3B92B5`
- Used in sidebar (`layout.tsx`) replacing the old Code2 lucide icon

## Design language (terminal-style)
- Tokens: `--info` (neon blue), `--success` (green), `--warning` (amber), `--purple` alongside primary cyan — use for status/active states, not decoration
- Sidebar: `w-14`, left-border active indicator (`absolute left-0 h-2px bg-primary`) instead of filled background
- Tabs: thin bottom-border indicator (`border-b-2 border-b-primary`) — no pill/background
- Buttons: new `xs`/`icon-xs`/`icon-sm` sizes; new `success`/`info` variants using `bg-success/15 text-success border border-success/30` pattern
- Badges: `info`/`success`/`warning`/`purple` variants — same `bg-X/10 text-X border-X/30` pattern
- File tabs: bottom-border indicator, amber dirty dot (`Circle fill-warning`), no rounded tabs
- Diff viewer: uses `bg-success/10 text-success` and `bg-destructive/10 text-destructive` — no hardcoded green/red classes
- Monaco theme: hex values required by Monaco API — synced to app tokens (bg `#0d0f14`, cursor `#09d9f5`, selection `#09d9f525`)
- Collapsible panels: `ImperativePanelHandle` ref + `collapsible collapsedSize={0}` + `onCollapse`/`onExpand` callbacks + toolbar toggle buttons (PanelLeft/PanelRight icons)
