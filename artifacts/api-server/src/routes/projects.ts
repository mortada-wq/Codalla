import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, projectsTable, settingsTable } from "@workspace/db";
import {
  CreateProjectBody,
  CreateProjectResponse,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  ListProjectsResponse,
} from "@workspace/api-zod";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const router: IRouter = Router();

const PROJECTS_BASE = path.join(process.cwd(), "codalla-projects");

// Folders that may be attached as projects (e.g. shared datasets on the
// server, a cloud-synced mount). Comma-separated absolute paths; empty means
// attaching existing folders is disabled.
const DATA_ROOTS = (process.env["CODALLA_DATA_ROOTS"] ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean).map((p) => path.resolve(p));

function isManagedPath(p: string): boolean {
  const resolved = path.resolve(p);
  return resolved.startsWith(path.resolve(PROJECTS_BASE) + path.sep);
}

// Resolves symlinks so an attacker can't link out of an allowed root.
function resolveAttachablePath(input: string): { path: string } | { error: string } {
  if (DATA_ROOTS.length === 0) {
    return { error: "Attaching existing folders is disabled. Set CODALLA_DATA_ROOTS on the server to enable it." };
  }
  let real: string;
  try {
    real = fs.realpathSync(path.resolve(input));
  } catch {
    return { error: `Folder does not exist on the server: ${input}` };
  }
  if (!fs.statSync(real).isDirectory()) {
    return { error: "The given path is a file, not a folder" };
  }
  const allowed = DATA_ROOTS.some((root) => real === root || real.startsWith(root + path.sep));
  if (!allowed) {
    return { error: "That folder is outside the allowed data roots (CODALLA_DATA_ROOTS)" };
  }
  return { path: real };
}

function ensureProjectDir(localPath: string) {
  if (!fs.existsSync(localPath)) fs.mkdirSync(localPath, { recursive: true });
}

function git(args: string[], cwd: string) {
  const result = spawnSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  return {
    ok: result.status === 0,
    stdout: result.stdout?.toString().trim() ?? "",
    stderr: result.stderr?.toString().trim() ?? "",
  };
}

function withAuth(rawUrl: string, token: string | null | undefined): string {
  if (!token || !rawUrl.startsWith("https://")) return rawUrl;
  try {
    const u = new URL(rawUrl);
    u.username = token;
    u.password = "x-oauth-basic";
    return u.toString();
  } catch { return rawUrl; }
}

function fmt(p: typeof projectsTable.$inferSelect) {
  return {
    ...p,
    lastSynced: p.lastSynced ? p.lastSynced.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable)
    .where(eq(projectsTable.userId, req.user!.id))
    .orderBy(projectsTable.createdAt);
  res.json(ListProjectsResponse.parse(projects.map(fmt)));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = uuidv4();

  // Attach an existing server folder (shared datasets, cloud mounts) instead
  // of creating a managed project directory. Git clone still works the same
  // for repo-backed projects; the two options are mutually exclusive.
  if (parsed.data.localPath) {
    if (parsed.data.gitRemoteUrl) {
      res.status(400).json({ error: "Choose either a repository URL or a server folder, not both" });
      return;
    }
    const resolved = resolveAttachablePath(parsed.data.localPath);
    if ("error" in resolved) {
      res.status(400).json({ error: resolved.error });
      return;
    }
    const [project] = await db.insert(projectsTable).values({
      id,
      userId: req.user!.id,
      name: parsed.data.name,
      localPath: resolved.path,
      gitRemoteUrl: null,
      description: parsed.data.description ?? null,
      story: parsed.data.story ?? null,
      target: parsed.data.target ?? null,
      currentBranch: git(["branch", "--show-current"], resolved.path).stdout || "main",
      lastSynced: null,
    }).returning();
    res.status(201).json(CreateProjectResponse.parse(fmt(project)));
    return;
  }

  const localPath = path.join(PROJECTS_BASE, id);
  ensureProjectDir(localPath);

  let clonedBranch: string | null = null;
  if (parsed.data.gitRemoteUrl) {
    const url = parsed.data.gitRemoteUrl.trim();
    if (!url.startsWith("https://") && !url.startsWith("git@")) {
      fs.rmSync(localPath, { recursive: true, force: true });
      res.status(400).json({ error: "Repository URL must start with https:// or git@" });
      return;
    }

    const perRequestToken = typeof req.body?.githubToken === "string" && req.body.githubToken.trim()
      ? req.body.githubToken.trim() : null;

    let token: string | null = perRequestToken;
    if (!token) {
      const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, req.user!.id));
      token = settings?.githubToken ?? null;
    }

    const authedUrl = withAuth(url, token);
    const result = git(["clone", "--depth", "50", authedUrl, "."], localPath);
    if (!result.ok) {
      fs.rmSync(localPath, { recursive: true, force: true });
      const raw = result.stderr.replace(/https:\/\/[^@\s]+@/g, "https://***@") || "git clone failed";
      const isAuthNeeded = /could not read Username|Authentication failed|remote: Repository not found|remote: Invalid username or password/i.test(raw);
      const cloneError = isAuthNeeded
        ? "This repository looks private (or the URL is wrong). Add a GitHub Personal Access Token below (scope: repo) and try again."
        : `Failed to clone repository: ${raw}`;
      res.status(400).json({ error: cloneError });
      return;
    }
    clonedBranch = git(["branch", "--show-current"], localPath).stdout || null;
  }

  const [project] = await db.insert(projectsTable).values({
    id,
    userId: req.user!.id,
    name: parsed.data.name,
    localPath,
    gitRemoteUrl: parsed.data.gitRemoteUrl ?? null,
    description: parsed.data.description ?? null,
    story: parsed.data.story ?? null,
    target: parsed.data.target ?? null,
    currentBranch: clonedBranch ?? "main",
    lastSynced: parsed.data.gitRemoteUrl ? new Date() : null,
  }).returning();

  res.status(201).json(CreateProjectResponse.parse(fmt(project)));
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable)
    .where(and(
      eq(projectsTable.id, params.data.projectId),
      eq(projectsTable.userId, req.user!.id),
    ));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(GetProjectResponse.parse(fmt(project)));
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db.update(projectsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(
      eq(projectsTable.id, params.data.projectId),
      eq(projectsTable.userId, req.user!.id),
    ))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(UpdateProjectResponse.parse(fmt(project)));
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.delete(projectsTable)
    .where(and(
      eq(projectsTable.id, params.data.projectId),
      eq(projectsTable.userId, req.user!.id),
    ))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Only remove directories Codalla created itself. Attached folders
  // (shared datasets under CODALLA_DATA_ROOTS) must survive project deletion.
  try {
    if (isManagedPath(project.localPath) && fs.existsSync(project.localPath)) {
      fs.rmSync(project.localPath, { recursive: true, force: true });
    }
  } catch { /* best-effort */ }

  res.sendStatus(204);
});

export default router;
