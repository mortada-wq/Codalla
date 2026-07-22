# Codalla Design System

A reference spec for Codalla's visual language: a warm flame-orange accent on cool, steel-blue neutrals — a terminal-native aesthetic for an AI coding IDE. One brand, two themes — **dark is the native register** (default, built around a near-black navy canvas built for long editor sessions) and **light is the daylight register** (icy blue-grey surfaces, same accent, same density). Neither theme is a reskin of the other; both share the same six-swatch palette, type scale, spacing, and component rules.

---

## 1. Brand Foundations

**Positioning:** a fast, no-nonsense AI coding IDE — chat, editor, and file tree in one surface. The flame orange keeps a developer tool (diffs, tokens, model IDs, terminal output) from feeling sterile, while the steel-blue neutral scale keeps it disciplined and dense enough for real work: file trees, diff viewers, usage tables, conversation history.

**Core tension to preserve:** technical/dense (hairlines, monospace data, compact tables) vs. warm/confident (single flame-orange accent, rounded 6px surfaces). Lean too far into either and it stops reading as Codalla.

**Two themes, one system:** dark mode is not an afterthought — it's the primary register most users see first (editor-heavy tools live in dark). Light mode exists for daylight use and accessibility preference, built from the same HSL primitives with lightness inverted, never a different palette.

---

## 2. Color Tokens

### 2.1 Brand core (six-swatch palette, shared across both themes)

| Token | Hex | Use |
|---|---|---|
| `--brand-flame` | `#E15A0D` | Primary accent — logo mark, primary buttons, active states, focus ring |
| `--brand-charcoal-navy` | `#1E2733` | Dark card surface / light-theme foreground text |
| `--brand-steel-blue` | `#6B8194` | Muted foreground, both themes (brightened in dark) |
| `--brand-neutral-grey` | `#B5B5B7` | Secondary surface accents |
| `--brand-periwinkle` | `#B7D0F5` | Info tint, light-theme highlight |
| `--brand-pale-grey` | `#E5E5E5` | Dark-theme foreground text / light-theme muted surface |

The wordmark's flame path is always literal `#E15A0D` — never swap it for a token, and never recolor or distort it. The "odalla" letterforms use `currentColor` so they inherit `--foreground` in either theme.

### 2.2 Light theme — icy blue-grey surface scale

Codalla's light theme is not neutral gray like a generic SaaS product — it carries a cool blue undertone that matches the brand's steel-blue swatch, so orange has something calm to sit on top of.

| Token | HSL | Hex (approx.) | Use |
|---|---|---|---|
| `--background` | `215 40% 96%` | `#EFF3F9` | App/page background |
| `--sidebar` | `215 42% 92%` | `#E2E9F3` | Sidebar — one step deeper than page bg for separation |
| `--card` / `--popover` | `0 0% 100%` | `#FFFFFF` | Cards, modals, table rows — pure white lifts off the icy bg |
| `--card-border` / `--border` / `--input` | `215 28% 86%` | `#D1DAE5` | Hairline borders, dividers, input outlines |
| `--secondary` / `--muted` | `215 34% 93%` | `#E7ECF3` | Secondary surface wash, muted panel fill |
| `--accent` | `215 34% 91%` | `#E0E7F0` | Hover surface |
| `--sidebar-accent` | `215 34% 88%` | `#D6DFEB` | Sidebar hover/active row |
| `--foreground` / `--card-foreground` | `215 26% 15%` | `#1E2733` | Primary body text, headings |
| `--muted-foreground` | `207 16% 50%` | `#6B8194` | Secondary text, placeholders, icons |
| `--primary` / `--ring` | `24 89% 47%` | `#E15A0D` | Primary accent, focus ring |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text/icons on primary fill |

### 2.3 Dark theme — cool near-black navy (kept as-is, unchanged)

The dark theme is the existing, shipped palette — do not restyle it to match the light theme's structure beyond sharing tokens. It stays a deeper, punchier register so the flame orange has maximum contrast against a near-black canvas.

| Token | HSL | Hex (approx.) | Use |
|---|---|---|---|
| `--background` | `213 24% 8%` | `#0F1419` | App background — deeper than card so cards float |
| `--sidebar` | `213 26% 6%` | `#0B0F13` | Sidebar — deepest surface, below background |
| `--card` / `--popover` / `--secondary` | `215 26% 15%` | `#1E2733` | Cards, modals, secondary surfaces |
| `--muted` | `215 24% 13%` | `#192029` | Muted panel fill |
| `--card-border` / `--border` / `--input` | `213 20% 22%` | `#2D3743` | Hairline borders, dividers, input outlines |
| `--accent` / `--sidebar-accent` | `213 20% 20%` | `#29323D` | Hover surface — between card and border |
| `--foreground` / `--card-foreground` | `0 0% 90%` | `#E5E5E5` | Primary body text, headings |
| `--muted-foreground` | `207 16% 60%` | `#899BA9` | Secondary text, placeholders (steel blue, brightened) |
| `--primary` / `--ring` | `22 88% 50%` | `#F0620F` | Primary accent (slightly brighter than light for dark contrast) |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text/icons on primary fill |

### 2.4 Semantic / status (both themes, functional accents)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--success` | `158 68% 34%` `#1C9266` | `158 68% 48%` `#27CE91` | Passed, active, healthy |
| `--warning` | `38 92% 50%` `#F59F0A` | `38 92% 58%` `#F6AE31` | Degraded, dirty/unsaved, needs attention |
| `--destructive` | `0 72% 46%` `#CA2121` | `0 70% 55%` `#DD3C3C` | Error, blocked, delete |
| `--info` | `215 76% 84%` `#B7D1F5` | `215 76% 72%` `#81AFEE` | Links, informational tags (periwinkle swatch) |
| `--purple` | `265 65% 55%` `#8042D7` | `265 70% 68%` `#A474E7` | Extra status category (never a 5th "brand" color — status only) |

Accessibility note: every status color pair is tuned so foreground text/icon-on-tint clears 4.5:1 against its own `-foreground` counterpart. Never ship a status pairing that only works in one theme — check both when adding a new status color.

### 2.5 Gradient

`linear-gradient(135deg, #E15A0D 0%, #F0620F 100%)` (light → dark primary) — used sparingly: top-of-editor accent bars, plan/usage upsell CTAs, loading bars. Never a full-page background; always a band, badge, or button.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| UI | **IBM Plex Sans** (fallback Inter, system-ui) | The entire product surface runs on this one family — no serif, no display face |
| Code / data | **IBM Plex Mono** (fallback JetBrains Mono, SF Mono) | Costs, tokens, model IDs, file paths, branch names, diffs, terminal output |

Base document font size is **14px** (`html { font-size: 14px }`), tighter than a marketing site — this is a dense, editor-first product. Body text carries `-0.005em` letter-spacing and font-feature-settings `cv02, cv03, cv04, cv11` for IBM Plex Sans's alternate figures.

### Type scale (four tiers — enforced app-wide, see `.agents/memory/codalla-type-scale.md`)

| Tier | Class | Size | Weight | Use |
|---|---|---|---|---|
| Display | `.type-display` | 20px (`text-xl`) | 600 | Page H1 only |
| Section | `.type-section` | 15px | 600 | Card/panel titles |
| Label | `.type-label` | 13px | 400 | Body copy, form labels, empty states |
| Meta | `.type-meta` | 12px (`text-xs`) | 400 | Secondary/muted inline text |
| Data | `.type-data` | 13px | 500, mono | Costs, tokens, model IDs, paths, hashes |

**Hard floor: 12px minimum.** No `text-[9px]/[10px]/[11px]` anywhere — illegible at normal DPI and fails WCAG minimum size guidance.

**Mono stays on:** costs, token/request counts, model IDs, file paths, code blocks, status bar (branch name, file extension), chat token/cost hover metadata, conversation model/provider label.

**Mono comes off:** UI labels, page subtitles, empty-state and loading copy, dialog descriptions, section headers.

---

## 4. Spacing, Grid & Radius

- **Base unit:** 4px, all spacing a multiple of 4 (4, 8, 12, 16, 24, 32, 48, 64).
- **Sidebar:** fixed `w-14` (56px) icon rail — not a wide labeled sidebar; density over hand-holding.
- **Card padding:** 16–24px internal padding, 8px gap between stacked cards.
- **Radius scale** (base `--radius: 0.375rem` / 6px):
  - `--radius-sm: 4px` — inputs, small buttons, badges
  - `--radius-md: 6px` — cards, dropdowns, terminal surfaces
  - `--radius-lg: 8px` — modals, large panels
  - `--radius-xl: 10px` — rare, large marketing-style surfaces
  - Never fully rounded (pill) except status badges.
- **Borders over shadows:** hairline `1px solid var(--border)` does the organizing work; box-shadow reserved for floating elements (modals, dropdowns, tooltips) at low opacity.

---

## 5. Iconography & Imagery

- **Icon style:** Lucide, thin-stroke, 14–20px grid sizes, monochrome by default (`currentColor`), switching to `--primary` only for the active sidebar item or an alert/dirty state.
- **The Codalla mark:** the flame path is always literal `#E15A0D`; the wordmark letterforms use `currentColor`. Never distort the mark's proportions or recolor the flame.
- **Editor chrome:** Monaco editor background matches `--card`, cursor and selection derive from `--primary` — the editor is a themed surface, not a separate dark-only zone bolted onto a light shell.
- **Data visualization:** usage/cost charts in orange/steel-blue — orange for the primary series (spend, tokens used), steel-blue/gray for baseline or comparison series.

---

## 6. Component Language

### 6.1 Buttons
- **Primary:** solid `--primary` fill, white text, `--radius-sm`, no shadow.
- **Secondary:** `--card` fill, `1px solid var(--border)`, `--foreground` text.
- **Ghost/tertiary:** no border, `--muted-foreground` text, background tint on hover.
- **Destructive:** `--destructive` outline or fill, paired with a confirmation dialog for delete/disable actions.
- **Success / Info variants:** `bg-success/15 text-success border border-success/30` (and the `info` equivalent) — used for status actions, not decoration.
- **Sizes:** default, `sm`, `xs`, `icon`, `icon-xs`, `icon-sm` — the dense IDE chrome (toolbars, tabs, panel headers) leans on the small/icon sizes.
- Button text is a verb phrase in sentence case: "Run script," not "Submit."

### 6.2 Cards & panels
`--card` background, `1px solid var(--card-border)`, `--radius-md`, 16–24px padding. Header row: title (Section tier) left, action right, hairline divider beneath before body content. `.panel-header` utility: `h-9`, `bg-sidebar`, uppercase caption-style label, `border-b`.

### 6.3 Tables
Dense row height, hairline row dividers (no zebra striping), sticky header in `--sidebar`/`--muted` with caption-style uppercase column labels, right-aligned numeric columns, `.type-data` (mono) for ID/cost/token columns, row-hover uses `--accent`.

### 6.4 Badges / status pills
Small, fully rounded, tint-on-tint (`bg-X/10 text-X border-X/30` for `info`/`success`/`warning`/`purple`/`destructive`) — never a solid saturated fill. Consistent with the button success/info pattern above.

### 6.5 Navigation
- **Sidebar (icon rail, `w-14`):** active item marked with a left-border accent (`.active-indicator` utility — 2px `--primary` bar, `data-active="true"` toggles opacity), not a filled row. Same rule in both themes.
- **Tabs (editor file tabs, settings tabs):** thin bottom-border indicator (`border-b-2 border-b-primary`) — no pill, no filled background. Unsaved file tabs show an amber dirty dot (`Circle fill-warning`).
- **Breadcrumbs:** `--muted-foreground` text, `/` separators, current page in `--foreground`.

### 6.6 Forms
Inputs: `1px solid var(--input)`, `--radius-sm`, focus ring `2px solid var(--ring)`, label above field, helper text (Label tier) `--muted-foreground` below, error text `--destructive` replacing helper text on validation failure.

### 6.7 Modals, drawers & panels
Centered dialog for short confirmations/destructive actions. Collapsible side panels (file tree, chat) use `ImperativePanelHandle` + `collapsible collapsedSize={0}` + toolbar toggle buttons — not full-screen drawers — so the editor layout persists across collapse/expand.

### 6.8 Diff viewer
`bg-success/10 text-success` for additions, `bg-destructive/10 text-destructive` for deletions — always the semantic tokens, never hardcoded green/red classes.

---

## 7. Motion

- **Duration:** 120–180ms hover/press micro-interactions, 200–240ms panel/drawer/tab transitions.
- **Easing:** `ease-out` entrances, `ease-in` exits — nothing bouncy; an editor should feel instant, not playful.
- **What moves:** color/background transitions on hover, panel collapse/expand, dropdown fade+scale, toast slide-up.
- **What doesn't move:** page-level content on load — speed and stability are the product's promise. Long-running work (AI streaming) gets a token-by-token stream, not a spinner-then-reveal.

---

## 8. Voice & Microcopy

- Plain, direct, technically confident. Short sentences, active voice.
- Errors state what happened and how to fix it, no apology: "This model isn't configured yet. Add an API key to continue."
- Empty states are instructional, not cute: "No conversations yet. Start one to begin."
- Labels describe what the user controls, not the underlying system: "Model," not "provider base URL override."

---

## 9. Signature Elements (what makes it unmistakably Codalla)

1. **Single-hue accent discipline** — one flame orange, used everywhere it matters (logo, primary actions, active states) and nowhere else; status colors (`success`/`warning`/`destructive`/`info`/`purple`) stay in their tint-on-tint lane, never competing with the brand accent.
2. **Left-accent-bar active states** — sidebar and no filled-row nav; a quiet, precise "you are here," identical in both themes.
3. **Bottom-border tabs, not pills** — editor file tabs and settings tabs use a 2px underline indicator, never a rounded/filled tab.
4. **Monospace as a first-class citizen** — costs, tokens, model IDs, paths, and branch names sit in `.type-data` mono inline with prose, reinforcing developer credibility.
5. **One palette, two lightnesses** — dark and light share the exact same HSL hues (flame orange, steel blue, periwinkle) at inverted lightness, so a screenshot from either theme is recognizably the same product.

---

## 10. Quick-reference CSS variables

```css
:root {
  /* Light theme — icy blue-grey */
  --background: 215 40% 96%;        /* #EFF3F9 */
  --foreground: 215 26% 15%;        /* #1E2733 */

  --card: 0 0% 100%;
  --card-foreground: 215 26% 15%;
  --card-border: 215 28% 86%;       /* #D1DAE5 */

  --popover: 0 0% 100%;
  --popover-foreground: 215 26% 15%;
  --popover-border: 215 28% 86%;

  --primary: 24 89% 47%;            /* #E15A0D — brand flame */
  --primary-foreground: 0 0% 100%;

  --secondary: 215 34% 93%;
  --secondary-foreground: 215 26% 15%;

  --muted: 215 34% 93%;
  --muted-foreground: 207 16% 50%;  /* #6B8194 — steel blue */

  --accent: 215 34% 91%;
  --accent-foreground: 215 26% 15%;

  --destructive: 0 72% 46%;
  --destructive-foreground: 0 0% 100%;

  --border: 215 28% 86%;
  --input: 215 28% 86%;
  --ring: 24 89% 47%;

  --info: 215 76% 84%;              /* #B7D0F5 — periwinkle */
  --info-foreground: 215 40% 25%;
  --success: 158 68% 34%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 215 26% 15%;
  --purple: 265 65% 55%;
  --purple-foreground: 0 0% 100%;

  --sidebar: 215 42% 92%;
  --sidebar-foreground: 215 24% 25%;
  --sidebar-border: 215 28% 86%;
  --sidebar-primary: 24 89% 47%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 215 34% 88%;
  --sidebar-accent-foreground: 215 26% 15%;

  --radius: 0.375rem;
  --app-font-sans: 'IBM Plex Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --app-font-mono: 'IBM Plex Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
}

.dark {
  /* Dark theme — cool near-black navy (unchanged, current shipped values) */
  --background: 213 24% 8%;         /* #0F1419 */
  --foreground: 0 0% 90%;           /* #E5E5E5 */

  --card: 215 26% 15%;              /* #1E2733 */
  --card-foreground: 0 0% 90%;
  --card-border: 213 20% 22%;

  --popover: 215 26% 15%;
  --popover-foreground: 0 0% 90%;
  --popover-border: 213 20% 22%;

  --primary: 22 88% 50%;
  --primary-foreground: 0 0% 100%;

  --secondary: 215 26% 15%;
  --secondary-foreground: 0 0% 90%;

  --muted: 215 24% 13%;
  --muted-foreground: 207 16% 60%;

  --accent: 213 20% 20%;
  --accent-foreground: 0 0% 90%;

  --destructive: 0 70% 55%;
  --destructive-foreground: 0 0% 100%;

  --border: 213 20% 22%;
  --input: 213 20% 22%;
  --ring: 22 88% 50%;

  --info: 215 76% 72%;
  --info-foreground: 213 24% 8%;
  --success: 158 68% 48%;
  --success-foreground: 213 24% 8%;
  --warning: 38 92% 58%;
  --warning-foreground: 213 24% 8%;
  --purple: 265 70% 68%;
  --purple-foreground: 213 24% 8%;

  --sidebar: 213 26% 6%;
  --sidebar-foreground: 0 0% 90%;
  --sidebar-border: 213 20% 22%;
  --sidebar-primary: 22 88% 50%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 213 20% 20%;
  --sidebar-accent-foreground: 0 0% 90%;
}
```

---

*Source of truth: `artifacts/codalla/src/index.css` (color tokens, utilities), `.agents/memory/codalla-type-scale.md` (type tiers), `.agents/memory/codalla-arch.md` (component/design language notes), `artifacts/codalla/src/components/logo.tsx` (brand mark). Dark-theme values are copied verbatim from the current shipped CSS; the light theme is the same file's existing light tokens, formalized here into the same structure so both themes live in one spec.*
