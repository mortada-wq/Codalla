# Yalla Sahib — Open, Provider-Agnostic AI Coding Agent

> **"Let's go, Sahib!"** — An AI coding environment that runs in the browser, on the desktop, and in Docker, with no vendor lock-in.

**Created by Mortada Gzar** — a novelist, not a coder. Yalla Sahib was built out of sheer will and curiosity, proving that the best tools aren't always made by the people you'd expect.

---

## Why Yalla Sahib

| | Cursor | Kiro | Yalla Sahib |
|---|---|---|---|
| Model vendors | Anthropic-primary | AWS Bedrock | **10+ providers, user-supplied keys** |
| Runs offline | No | No | **Yes (Ollama)** |
| Desktop app | Yes | No | **Yes (Electron, mac/win/linux)** |
| Auth | Proprietary | AWS | **Firebase (Google, GitHub, Phone)** |
| Deploy targets | None | None | **Cloudflare Pages, Vercel, Netlify, Docker** |

The core bet: **bring your own model, run anywhere, own your data.**

---

## What's Inside

### Firebase Authentication
- Google, GitHub, and phone-number sign-in
- Auth-gated chat sessions with persistent user state

### GitLab Integration
- Browse and import from GitLab projects and branches
- Complements the built-in GitHub integration

### Supabase Integration
- Supabase user auth, direct query runner, and environment variable sync
- First-class support for Supabase-backed apps built inside the agent

### Multi-Cloud Deploy
- One-click deploy to Vercel and Netlify from inside the chat

### Web Search
- Agent can search the web for docs and examples during code generation

### File & Folder Locking
- Lock files or folders so neither you nor the AI can accidentally overwrite them
- Visual lock indicators in the file tree, persistent across sessions

### 10+ Model Providers
Switch between providers in Settings — no rebuild required:
Anthropic · OpenAI · Google · AWS Bedrock · Mistral · Cohere · DeepSeek · Fireworks · Cerebras · OpenRouter · **Ollama (fully offline)**

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- pnpm (`npm i -g pnpm`)

### Run Locally

```bash
git clone https://github.com/mortada-wq/Yallahsahib_sahibeen_v01.git
cd Yallahsahib_sahibeen_v01
pnpm install
cp .env.example .env.local   # add your API keys
pnpm dev                      # http://localhost:5173
```

### Desktop App (Electron)

```bash
pnpm electron:dev             # dev mode
pnpm electron:build:mac       # production build for macOS
pnpm electron:build:win       # Windows
pnpm electron:build:linux     # Linux
```

### Docker

```bash
pnpm dockerbuild
pnpm dockerrun                # http://localhost:5173
```

### Cloudflare Pages

```bash
pnpm install
pnpm run deploy
```

Cloudflare deployment expects these repository secrets (used by GitHub Actions):
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

For local/manual deploys, authenticate Wrangler first:

```bash
pnpm exec wrangler login
```

---

## Project Structure

```
app/
├── components/       # UI components (chat, workbench, editor, auth)
├── lib/
│   ├── firebase.ts   # Auth setup
│   ├── hooks/        # React hooks
│   └── stores/       # nanostores for global state
├── routes/           # Remix routes — API endpoints + pages
│   ├── login.tsx / signup.tsx
│   ├── api.gitlab-*.ts
│   ├── api.supabase*.ts
│   ├── api.vercel-deploy.ts / api.netlify-deploy.ts
│   └── api.web-search.ts
electron/             # Electron main + preload (desktop shell)
scripts/              # Build helpers
```

---

## Contributing

1. Fork → feature branch → PR with a description of what changed and why.
2. Run `pnpm lint` and `pnpm test` before submitting.
3. See `CONTRIBUTING.md` for details.

---

**License:** MIT · **Author:** Mortada Gzar
