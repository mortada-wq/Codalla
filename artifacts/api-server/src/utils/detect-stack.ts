import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, normalize } from "path";

/** Approved roots for project directories — stack detection must stay inside these. */
const ALLOWED_ROOTS = [
  resolve(process.cwd(), "codalla-projects"),
  resolve(process.cwd(), "projects"),
  "/tmp/codalla-projects",
];

function isSafeProjectPath(localPath: string): boolean {
  if (!localPath || localPath.trim() === "") return false;
  try {
    const resolved = resolve(normalize(localPath));
    // Must be a directory, not a file or symlink to outside an allowed root
    if (!existsSync(resolved)) return false;
    const stat = statSync(resolved);
    if (!stat.isDirectory()) return false;
    return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + "/"));
  } catch {
    return false;
  }
}

export interface StackInfo {
  languages: string[];      // ["TypeScript", "Python", ...]
  frameworks: string[];     // ["React 18", "Vite", "Express", ...]
  styling: string[];        // ["Tailwind CSS", "styled-components", ...]
  databases: string[];      // ["PostgreSQL", "SQLite", ...]
  testing: string[];        // ["Vitest", "Jest", "Pytest", ...]
  appType: string;          // "full-stack web app", "REST API", "CLI tool", ...
  rules: string[];          // stack-specific coding conventions
}

function tryReadJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function tryRead(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function hasDep(pkg: any, name: string): boolean {
  return !!(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
}

function hasFile(root: string, ...names: string[]): boolean {
  return names.some(n => existsSync(join(root, n)));
}

export function detectProjectStack(localPath: string): StackInfo {
  const info: StackInfo = {
    languages: [],
    frameworks: [],
    styling: [],
    databases: [],
    testing: [],
    appType: "software project",
    rules: [],
  };

  // Reject paths outside approved project roots — prevents scanning arbitrary server paths
  if (!isSafeProjectPath(localPath)) return info;

  const pkg = tryReadJson(join(localPath, "package.json"));

  // ── Language detection ────────────────────────────────────────────────────
  const isPython = hasFile(localPath, "requirements.txt", "pyproject.toml", "setup.py", "main.py");
  const isRust = hasFile(localPath, "Cargo.toml");
  const isGo = hasFile(localPath, "go.mod");

  if (pkg) {
    const hasTs = hasDep(pkg, "typescript") || hasFile(localPath, "tsconfig.json");
    info.languages.push(hasTs ? "TypeScript" : "JavaScript");
  } else if (isPython) {
    info.languages.push("Python");
  } else if (isRust) {
    info.languages.push("Rust");
  } else if (isGo) {
    info.languages.push("Go");
  }

  if (!pkg) {
    // ── Python ────────────────────────────────────────────────────────────
    if (isPython) {
      const reqs = tryRead(join(localPath, "requirements.txt")) ?? "";
      const pyProject = tryRead(join(localPath, "pyproject.toml")) ?? "";
      const combined = reqs + pyProject;

      if (combined.match(/fastapi/i)) info.frameworks.push("FastAPI");
      if (combined.match(/flask/i)) info.frameworks.push("Flask");
      if (combined.match(/django/i)) info.frameworks.push("Django");
      if (combined.match(/streamlit/i)) info.frameworks.push("Streamlit");
      if (combined.match(/sqlalchemy/i)) info.databases.push("SQLAlchemy");
      if (combined.match(/psycopg|postgres/i)) info.databases.push("PostgreSQL");
      if (combined.match(/sqlite/i)) info.databases.push("SQLite");
      if (combined.match(/pytest/i)) info.testing.push("pytest");

      info.rules.push("Follow PEP 8 style guidelines");
      info.rules.push("Use type hints for all function signatures");
      info.rules.push("Prefer f-strings for string formatting");
      info.rules.push("Use context managers (with statements) for resource management");

      if (info.frameworks.includes("FastAPI")) {
        info.rules.push("Use Pydantic models for request/response validation");
        info.rules.push("Use async/await for route handlers");
        info.appType = "REST API";
      } else if (info.frameworks.includes("Streamlit")) {
        info.appType = "data app";
      } else if (info.frameworks.includes("Django")) {
        info.appType = "web application";
      }
    }

    // ── Rust ────────────────────────────────────────────────────────────
    if (isRust) {
      const cargo = tryRead(join(localPath, "Cargo.toml")) ?? "";
      if (cargo.includes("axum")) { info.frameworks.push("Axum"); info.appType = "REST API"; }
      if (cargo.includes("tokio")) info.frameworks.push("Tokio");
      if (cargo.includes("serde")) info.frameworks.push("Serde");
      info.rules.push("Prefer Result<T, E> over panicking — propagate errors with ?");
      info.rules.push("Follow Rust ownership and borrowing rules — minimize .clone()");
      info.rules.push("Use #[derive(Debug, Clone, Serialize, Deserialize)] where appropriate");
    }

    // ── Go ────────────────────────────────────────────────────────────
    if (isGo) {
      const goMod = tryRead(join(localPath, "go.mod")) ?? "";
      if (goMod.includes("gin-gonic")) { info.frameworks.push("Gin"); info.appType = "REST API"; }
      if (goMod.includes("fiber")) { info.frameworks.push("Fiber"); info.appType = "REST API"; }
      info.rules.push("Return (T, error) from functions — never panic in library code");
      info.rules.push("Use context.Context as first parameter for cancellable operations");
      info.rules.push("Follow Go naming conventions: CamelCase exports, camelCase internals");
    }

    return info;
  }

  // ── JavaScript / TypeScript ecosystem ────────────────────────────────────
  const isTs = info.languages.includes("TypeScript");

  // Frontend frameworks
  const isReact = hasDep(pkg, "react");
  const isNext = hasDep(pkg, "next");
  const isVue = hasDep(pkg, "vue");
  const isNuxt = hasDep(pkg, "nuxt");
  const isSvelte = hasDep(pkg, "svelte") || hasDep(pkg, "@sveltejs/kit");
  const isAngular = hasDep(pkg, "@angular/core");
  const isExpo = hasDep(pkg, "expo");
  const isElectron = hasDep(pkg, "electron");

  // Backend frameworks
  const isExpress = hasDep(pkg, "express");
  const isFastify = hasDep(pkg, "fastify");
  const isHono = hasDep(pkg, "hono");
  const isNestJs = hasDep(pkg, "@nestjs/core");

  // Build tools
  const isVite = hasDep(pkg, "vite");
  const isTurbo = hasFile(localPath, "turbo.json");
  const isPnpmWorkspace = hasFile(localPath, "pnpm-workspace.yaml");

  // Styling
  const isTailwind = hasDep(pkg, "tailwindcss");
  const isStyledComponents = hasDep(pkg, "styled-components");
  const isCssModules = hasFile(localPath, "src");
  const isShadcn = hasDep(pkg, "class-variance-authority") || hasDep(pkg, "@radix-ui/react-slot");

  // Database / ORM
  const isDrizzle = hasDep(pkg, "drizzle-orm");
  const isPrisma = hasDep(pkg, "@prisma/client") || hasDep(pkg, "prisma");
  const isMongoose = hasDep(pkg, "mongoose");
  const isSQLite = hasDep(pkg, "better-sqlite3") || hasDep(pkg, "@libsql/client");
  const isPostgres = hasDep(pkg, "pg") || hasDep(pkg, "postgres") || hasDep(pkg, "@neondatabase/serverless");

  // State management
  const isZustand = hasDep(pkg, "zustand");
  const isRedux = hasDep(pkg, "@reduxjs/toolkit");
  const isTanstack = hasDep(pkg, "@tanstack/react-query");

  // Testing
  const isVitest = hasDep(pkg, "vitest");
  const isJest = hasDep(pkg, "jest");
  const isPlaywright = hasDep(pkg, "@playwright/test") || hasDep(pkg, "playwright");
  const isCypress = hasDep(pkg, "cypress");

  // Determine app type
  const hasFrontend = isReact || isVue || isSvelte || isAngular || isNext || isNuxt;
  const hasBackend = isExpress || isFastify || isHono || isNestJs;

  if (isElectron) info.appType = "desktop application";
  else if (isExpo) info.appType = "mobile application";
  else if (isNext || isNuxt) info.appType = "full-stack web application";
  else if (hasFrontend && hasBackend) info.appType = "full-stack web application";
  else if (hasFrontend) info.appType = "frontend web application";
  else if (hasBackend) info.appType = "REST API / backend service";
  else info.appType = "Node.js application";

  // Build framework list
  if (isNext) info.frameworks.push("Next.js");
  else if (isReact) {
    const reactVer = pkg.dependencies?.react || pkg.devDependencies?.react || "";
    const major = parseInt(reactVer.replace(/[^0-9]/, "")) || 18;
    info.frameworks.push(`React ${major}`);
  }
  if (isVue) info.frameworks.push(isNuxt ? "Nuxt 3" : "Vue 3");
  if (isSvelte) info.frameworks.push("SvelteKit");
  if (isAngular) info.frameworks.push("Angular");
  if (isExpo) info.frameworks.push("Expo");
  if (isElectron) info.frameworks.push("Electron");
  if (isVite) info.frameworks.push("Vite");
  if (isExpress) info.frameworks.push("Express");
  if (isFastify) info.frameworks.push("Fastify");
  if (isHono) info.frameworks.push("Hono");
  if (isNestJs) info.frameworks.push("NestJS");

  // Styling
  if (isTailwind) {
    info.styling.push("Tailwind CSS");
    if (isShadcn) info.styling.push("shadcn/ui");
  }
  if (isStyledComponents) info.styling.push("styled-components");

  // Database
  if (isDrizzle) {
    info.databases.push("Drizzle ORM");
    if (isPostgres) info.databases.push("PostgreSQL");
    else if (isSQLite) info.databases.push("SQLite");
  } else if (isPrisma) {
    info.databases.push("Prisma");
    if (isPostgres) info.databases.push("PostgreSQL");
  } else if (isMongoose) {
    info.databases.push("MongoDB (Mongoose)");
  } else if (isPostgres) {
    info.databases.push("PostgreSQL");
  }

  // State / data fetching
  if (isTanstack) info.frameworks.push("TanStack Query");
  if (isZustand) info.frameworks.push("Zustand");
  if (isRedux) info.frameworks.push("Redux Toolkit");

  // Testing
  if (isVitest) info.testing.push("Vitest");
  if (isJest) info.testing.push("Jest");
  if (isPlaywright) info.testing.push("Playwright");
  if (isCypress) info.testing.push("Cypress");

  // ── Derive coding rules from stack ──────────────────────────────────────
  if (isTs) {
    info.rules.push("Use strict TypeScript — prefer explicit types, avoid `any`");
    info.rules.push("Use `interface` for object shapes, `type` for unions/aliases");
  }

  if (isReact || isNext) {
    info.rules.push("Use functional components with hooks — never class components");
    info.rules.push("Name components in PascalCase, hooks as `use*`");
    if (isTs) info.rules.push("Type component props with an `interface Props` or inline type");
  }

  if (isNext) {
    info.rules.push("Use the App Router with server and client components — add `'use client'` only when needed");
    info.rules.push("Co-locate server data fetching in page/layout components");
  }

  if (isTailwind) {
    info.rules.push("Use Tailwind utility classes for all styling — no inline `style` props or separate CSS files");
    if (isShadcn) {
      info.rules.push("Use shadcn/ui components for UI primitives — import from `@/components/ui/`");
      info.rules.push("Extend with `cn()` from `@/lib/utils` for conditional class merging");
    }
  }

  if (isDrizzle) {
    info.rules.push("Use Drizzle ORM for all database operations — no raw SQL strings");
    info.rules.push("Define all schema in `lib/db/src/schema/index.ts` and run `db push` to migrate");
  }

  if (isPrisma) {
    info.rules.push("Use Prisma Client for all database operations — keep schema in `prisma/schema.prisma`");
  }

  if (isExpress) {
    info.rules.push("Type route handlers as `async (req, res): Promise<void>` — always `return` after `res.json()`");
    info.rules.push("Validate request bodies with Zod before trusting any input");
  }

  if (isVitest) {
    info.rules.push("Write tests with Vitest — use `describe`, `it`, `expect` from `vitest`");
  }

  if (isTanstack) {
    info.rules.push("Use TanStack Query hooks for server state — avoid manual fetch in components");
    info.rules.push("Invalidate queries after mutations rather than merging state manually");
  }

  return info;
}

export function buildSystemPrompt(opts: {
  projectName?: string;
  stack: StackInfo;
  story?: string | null;
  target?: string | null;
  criteria?: Array<{ label: string; done: boolean }>;
  memoryNotes?: Array<{ title: string; content: string | null }>;
}): string {
  const { projectName, stack, story, target, criteria, memoryNotes } = opts;

  const stackLine = [
    ...stack.languages,
    ...stack.frameworks,
    ...stack.styling,
    ...stack.databases,
  ].filter(Boolean).join(" · ") || "unknown stack";

  const lines: string[] = [];

  lines.push(`You are Codalla — an expert software engineer and pair programmer embedded in this ${stack.appType}.`);
  lines.push("");

  // Project identity
  if (projectName) lines.push(`PROJECT: ${projectName}`);
  lines.push(`STACK: ${stackLine}`);
  if (stack.testing.length) lines.push(`TESTING: ${stack.testing.join(", ")}`);
  lines.push("");

  // Purpose & goal
  if (story) {
    lines.push(`PURPOSE: ${story.trim()}`);
    lines.push("");
  }
  if (target) {
    lines.push(`SUCCESS TARGET: ${target.trim()}`);
    lines.push("");
  }

  // Success criteria
  if (criteria && criteria.length > 0) {
    const open = criteria.filter(c => !c.done);
    const done = criteria.filter(c => c.done);
    if (open.length > 0) {
      lines.push(`OPEN TASKS (${open.length}): ${open.map(c => c.label).join(" · ")}`);
    }
    if (done.length > 0) {
      lines.push(`COMPLETED: ${done.map(c => c.label).join(" · ")}`);
    }
    lines.push("");
  }

  // Memory notes
  if (memoryNotes && memoryNotes.length > 0) {
    lines.push("MEMORY NOTES:");
    for (const note of memoryNotes) {
      lines.push(`• ${note.title}${note.content ? `: ${note.content.trim()}` : ""}`);
    }
    lines.push("");
  }

  // Coding conventions
  if (stack.rules.length > 0) {
    lines.push("CODING CONVENTIONS — follow these precisely:");
    for (const rule of stack.rules) lines.push(`• ${rule}`);
    lines.push("");
  }

  // File-change format
  lines.push("When proposing file changes, format each file exactly like this so the editor can apply them with one click:");
  lines.push("");
  lines.push("### File: `relative/path/to/file.ext`");
  lines.push("```language");
  lines.push("FULL file content here — no ellipses or truncation");
  lines.push("```");
  lines.push("");
  lines.push("Rules: always include the complete file content; use forward slashes; you may include multiple File blocks per reply.");

  return lines.join("\n");
}
