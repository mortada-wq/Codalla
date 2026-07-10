---
name: Codalla typographic scale
description: Four-tier type scale enforced across the app; rules for what gets mono vs sans.
---

## The four tiers

| Tier | Class | Size | When |
|---|---|---|---|
| Display | `text-xl font-bold font-sans` | 20px | Page H1 headers only |
| Section | `text-sm font-semibold font-sans` | 14px | Card/panel titles, CardTitle |
| Label | `text-xs font-sans` | 12px | Body copy, descriptions, form labels, empty states, loading messages |
| Data | `text-xs font-mono` | 12px | Costs, tokens, model IDs, file paths, branch names, code |

CSS utility classes `.type-display`, `.type-section`, `.type-label`, `.type-data` defined in `src/index.css`.

## Hard floor: 12px minimum

No `text-[9px]`, `text-[10px]`, `text-[11px]` anywhere. Lift all to `text-xs`.

**Why:** Sub-12px text is illegible at normal DPI and violates WCAG minimum size guidance.

## font-mono stays on: data surfaces only

- Costs (`$0.00042`), token counts, request counts
- Model IDs and file paths
- Code inside `<pre>`/`<code>` blocks
- Status bar (branch name, file extension)
- Chat token/cost hover metadata
- Conversation selector (model/provider label)

## font-mono comes OFF: reading copy

- UI labels ("Story", "Target", "Provider")
- Page subtitles / descriptions
- Empty state messages ("No projects found", "No content")
- Loading indicators
- Dialog descriptions
- Section headers that label fields

## Shadcn primitives exception

`dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `drawer.tsx` retain their default `text-lg` titles — lower priority, avoid touching shadcn internals unless there's a compelling reason.

**How to apply:** Any new UI element gets `text-xs font-sans` by default (Label tier). Promote to Section if it's a named heading for a card or panel. Promote to Display only for the single page-level H1. If the value is a number, cost, or path — use `font-mono`.
