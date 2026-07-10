---
name: Codalla API quirks
description: Non-obvious design decisions in the OpenAPI spec and frontend wiring.
---

## Query-only endpoints (no path params)
Three endpoints moved from path-param + query-param to all-query to avoid Orval TS2308 name collisions:
- `GET /file-contents?projectId=&filePath=`
- `DELETE /file-contents?projectId=&filePath=`
- `GET /git-diff?projectId=&filePath=`

**Why:** When a path like `/projects/{projectId}/files` also has query params, Orval generates duplicate TypeScript type names (`DeleteFileParams` both for path and query). All-query avoids the collision.

## TooltipProvider in App.tsx
`<TooltipProvider>` must wrap the router in `App.tsx`. The sidebar `Layout` component uses `<Tooltip>` for icon tooltips and will throw at runtime without it.

**Why:** The design subagent wrote App.tsx without the provider; this was patched post-build.

## DB declarations
After changing `lib/db/src/schema/index.ts`, run `pnpm run typecheck:libs` before typechecking any consuming package, otherwise the TS declarations are stale.
