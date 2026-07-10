---
name: Codalla security decisions
description: Security constraints applied to git routes, filesystem, settings, and frontend rendering.
---

## Git command execution
Use `spawnSync("git", argsArray, { cwd })` — NEVER `execSync` with interpolated strings.
Validate branch names with `/^[a-zA-Z0-9._\-/]+$/` before passing as args.
Inject tokens into HTTPS URLs via the `URL` API (u.username = token), not shell args.

**Why:** execSync with string interpolation is a remote code execution vector when user controls branch names, file paths, or commit messages.

## Filesystem path containment
```ts
if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) return null;
```
The `+ path.sep` boundary check prevents sibling paths that share the base prefix from passing.

**Why:** `resolved.startsWith(base)` alone allows `/tmp/projects/abc123-extra` to pass when base is `/tmp/projects/abc123`.

## Settings: githubToken
The `GET /settings` response returns a masked value (`••••••••<last4>`) not the raw token.
The PUT endpoint accepts and stores the real value but never echoes it back.

**Why:** The API has no auth, so all responses are visible; raw tokens must not be in responses.

## Frontend: dangerouslySetInnerHTML
Always call `escapeHtml()` on AI-generated content before the markdown regex transforms.
The `formatMarkdown` function in `editor.tsx` and `markdown.tsx` both escape first.

**Why:** AI output is untrusted — injecting it directly into innerHTML enables XSS.
