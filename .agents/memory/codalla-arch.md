---
name: Codalla platform architecture
description: Stack, structure, and key technical decisions for the Codalla AI coding IDE.
---

## Stack
- **Frontend**: React + Vite, Tailwind, shadcn/ui, Monaco editor, wouter router, @tanstack/react-query, Orval-generated API hooks
- **Backend**: Express (artifacts/api-server), Zod validation from generated @workspace/api-zod
- **Database**: PostgreSQL via Drizzle ORM (lib/db)
- **AI**: openai npm package pointed at SiliconFlow / OpenRouter / RunPod / custom base URLs

## Key files
- `lib/api-spec/openapi.yaml` — single source of truth for API shape; run `pnpm --filter @workspace/api-spec run codegen` after any change
- `lib/db/src/schema/index.ts` — 9 tables: projects (with story/target), projectSuccessCriteria, projectMemoryNotes, apiKeys, conversations, messages, usageLogs, settings, customModels
- `artifacts/api-server/src/routes/` — health, projects, filesystem, github, ai, apikeys, usage, settings, models, criteria, memory
- `artifacts/codalla/src/` — 6 pages: dashboard, editor/:projectId, keys, usage, settings, models

## Post-merge checklist (always run after task merges)
1. `pnpm --filter @workspace/api-spec run codegen` — regenerates api-zod + api-client-react
2. `pnpm --filter @workspace/db run push` — applies schema changes to DB
3. Deduplicate `lib/api-client-react/src/index.ts` — codegen appends duplicate export lines
4. `pnpm --filter @workspace/api-server run typecheck && pnpm --filter @workspace/codalla run typecheck`

## AI chat system prompt (context-aware)
- `artifacts/api-server/src/utils/detect-stack.ts` — reads project localPath to detect tech stack
- Path guard: only reads paths under `codalla-projects/` or `projects/` — never arbitrary FS paths
- `getAutoSystemPrompt(projectId)` in ai.ts — fetches project+criteria+memory, builds tailored prompt
- Both `/ai/chat` and `/ai/chat/stream` always inject the auto prompt; frontend `systemPrompt` layers on top

## Important: zod in api-server routes
- api-server does NOT have zod as a direct dependency
- Do NOT `import { z } from "zod"` or `"zod/v4"` in route files — use manual validation or `@workspace/api-zod`

## AI chat streaming
- SSE endpoint at `POST /api/ai/chat/stream` (not in OpenAPI spec — raw route)
- Frontend uses native fetch + ReadableStream + AbortController; server handles `req.on('close')`

## Custom models
- `customModelsTable` in DB, CRUD at `/api/models/custom` (not in OpenAPI spec — raw Express routes)
- Frontend at `/models` — useEffect-based fetch hook

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
