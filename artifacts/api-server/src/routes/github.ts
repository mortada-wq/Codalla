import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { projectAccessWhere } from "../lib/project-access";
import { db, projectsTable } from "@workspace/db";
import {
  ListGithubReposQueryParams,
  ListGithubReposResponse,
  CloneRepoParams,
  CloneRepoBody,
  CloneRepoResponse,
  GetGitStatusParams,
  GetGitStatusResponse,
  GetFileDiffQueryParams,
  GetFileDiffResponse,
  CommitAndPushParams,
  CommitAndPushBody,
  CommitAndPushResponse,
  PullRepoParams,
  PullRepoBody,
  PullRepoResponse,
  ListBranchesParams,
  ListBranchesResponse,
  CheckoutBranchParams,
  CheckoutBranchBody,
  CheckoutBranchResponse,
} from "@workspace/api-zod";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

async function getProject(projectId: string, userId: string) {
  const [project] = await db.select().from(projectsTable)
    .where(projectAccessWhere(projectId, userId));
  return project ?? null;
}

/** Run git with an explicit argument array — no shell interpolation. */
function git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  return {
    ok: result.status === 0,
    stdout: result.stdout?.toString().trim() ?? "",
    stderr: result.stderr?.toString().trim() ?? "",
  };
}

function gitOrThrow(args: string[], cwd: string): string {
  const r = git(args, cwd);
  if (!r.ok) throw new Error(r.stderr || `git ${args[0]} failed`);
  return r.stdout;
}

/** Validate that a string is a safe, non-shell-special branch/ref name. */
function isValidRef(ref: string): boolean {
  // Git ref names must not contain these characters or patterns
  return /^[a-zA-Z0-9._\-/]+$/.test(ref) && !ref.includes("..") && ref.length <= 200;
}

/** Validate a relative file path — no traversal, no shell specials. */
function isValidRelativePath(p: string): boolean {
  return !p.includes("..") && !/[;&|`$<>\\]/.test(p) && p.length <= 500;
}

// GET /github/repos
router.get("/github/repos", async (req, res): Promise<void> => {
  const parsed = ListGithubReposQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, page = 1, perPage = 30 } = parsed.data;

  const response = await fetch(
    `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!response.ok) {
    res.status(response.status).json({ error: "GitHub API error" });
    return;
  }

  const repos = await response.json() as Array<Record<string, unknown>>;

  res.json(ListGithubReposResponse.parse(repos.map((r) => ({
    id: r["id"] as number,
    name: r["name"] as string,
    fullName: r["full_name"] as string,
    description: (r["description"] as string | null) ?? null,
    cloneUrl: r["clone_url"] as string,
    sshUrl: r["ssh_url"] as string,
    private: r["private"] as boolean,
    defaultBranch: r["default_branch"] as string,
    language: (r["language"] as string | null) ?? null,
    stargazersCount: r["stargazers_count"] as number,
    updatedAt: r["updated_at"] as string,
  }))));
});

// POST /projects/:projectId/github/clone
router.post("/projects/:projectId/github/clone", async (req, res): Promise<void> => {
  const params = CloneRepoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CloneRepoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const project = await getProject(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { repoUrl, branch, token } = body.data;

  // Validate the branch ref if provided
  if (branch && !isValidRef(branch)) {
    res.status(400).json({ error: "Invalid branch name" });
    return;
  }

  // Validate repo URL
  if (!repoUrl.startsWith("https://") && !repoUrl.startsWith("git@")) {
    res.status(400).json({ error: "Invalid repository URL" });
    return;
  }

  // Build authenticated URL (HTTPS only, inject token in URL, never in args)
  let cloneUrl = repoUrl;
  if (token && cloneUrl.startsWith("https://")) {
    // Use URL API to inject credentials safely — avoids any shell expansion
    try {
      const u = new URL(cloneUrl);
      u.username = token;
      u.password = "x-oauth-basic";
      cloneUrl = u.toString();
    } catch {
      res.status(400).json({ error: "Invalid repository URL" });
      return;
    }
  }

  // Clean the project directory
  if (fs.existsSync(project.localPath)) {
    fs.rmSync(project.localPath, { recursive: true, force: true });
  }
  fs.mkdirSync(project.localPath, { recursive: true });

  try {
    const cloneArgs = ["clone", "--depth", "50"];
    if (branch) cloneArgs.push("--branch", branch);
    cloneArgs.push(cloneUrl, ".");
    gitOrThrow(cloneArgs, project.localPath);

    const currentBranch = git(["branch", "--show-current"], project.localPath).stdout || "main";
    await db.update(projectsTable)
      .set({ gitRemoteUrl: repoUrl, currentBranch, lastSynced: new Date(), updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id));

    const commitHash = git(["rev-parse", "--short", "HEAD"], project.localPath).stdout;
    res.json(CloneRepoResponse.parse({ success: true, message: "Repository cloned successfully", commitHash: commitHash || null }));
  } catch (err) {
    res.status(500).json(CloneRepoResponse.parse({ success: false, message: String(err instanceof Error ? err.message : err), commitHash: null }));
  }
});

// GET /projects/:projectId/github/status
router.get("/projects/:projectId/github/status", async (req, res): Promise<void> => {
  const params = GetGitStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const project = await getProject(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const gitDir = path.join(project.localPath, ".git");
  if (!fs.existsSync(gitDir)) {
    res.json(GetGitStatusResponse.parse({ modified: [], added: [], deleted: [], untracked: [], branch: "none" }));
    return;
  }

  const statusOutput = git(["status", "--porcelain"], project.localPath).stdout;
  const branch = git(["branch", "--show-current"], project.localPath).stdout || "main";

  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];

  for (const line of statusOutput.split("\n")) {
    if (!line.trim()) continue;
    const xy = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (xy === "??") { untracked.push(file); }
    else if (xy.includes("A") || xy === " A") { added.push(file); }
    else if (xy.includes("D") || xy === " D") { deleted.push(file); }
    else { modified.push(file); }
  }

  res.json(GetGitStatusResponse.parse({ modified, added, deleted, untracked, branch }));
});

// GET /git-diff?projectId=&filePath=
router.get("/git-diff", async (req, res): Promise<void> => {
  const parsed = GetFileDiffQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!isValidRelativePath(parsed.data.filePath)) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }

  const project = await getProject(parsed.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const diff = git(["diff", "HEAD", "--", parsed.data.filePath], project.localPath).stdout;
  const addLines = (diff.match(/^\+[^+]/gm) || []).length;
  const delLines = (diff.match(/^-[^-]/gm) || []).length;

  res.json(GetFileDiffResponse.parse({ path: parsed.data.filePath, diff, additions: addLines, deletions: delLines }));
});

// POST /projects/:projectId/github/commit
router.post("/projects/:projectId/github/commit", async (req, res): Promise<void> => {
  const params = CommitAndPushParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CommitAndPushBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const project = await getProject(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Validate files list
  if (body.data.files) {
    for (const f of body.data.files) {
      if (!isValidRelativePath(f)) {
        res.status(400).json({ error: `Invalid file path: ${f}` });
        return;
      }
    }
  }

  try {
    git(["config", "user.email", "codalla@local"], project.localPath);
    git(["config", "user.name", "Codalla"], project.localPath);

    if (body.data.files && body.data.files.length > 0) {
      for (const f of body.data.files) {
        git(["add", "--", f], project.localPath);
      }
    } else {
      gitOrThrow(["add", "-A"], project.localPath);
    }

    // Commit message is passed as a proper arg — no shell injection
    gitOrThrow(["commit", "-m", body.data.message], project.localPath);

    if (project.gitRemoteUrl && body.data.token) {
      let remoteUrl = project.gitRemoteUrl;
      if (remoteUrl.startsWith("https://")) {
        const u = new URL(remoteUrl);
        u.username = body.data.token;
        u.password = "x-oauth-basic";
        remoteUrl = u.toString();
      }
      const branch = git(["branch", "--show-current"], project.localPath).stdout || "main";
      if (!isValidRef(branch)) throw new Error("Invalid branch name detected");
      gitOrThrow(["push", remoteUrl, branch], project.localPath);
    }

    const commitHash = git(["rev-parse", "--short", "HEAD"], project.localPath).stdout;
    await db.update(projectsTable).set({ lastSynced: new Date(), updatedAt: new Date() }).where(eq(projectsTable.id, project.id));

    res.json(CommitAndPushResponse.parse({ success: true, message: "Committed and pushed", commitHash: commitHash || null }));
  } catch (err) {
    res.status(500).json(CommitAndPushResponse.parse({ success: false, message: String(err instanceof Error ? err.message : err), commitHash: null }));
  }
});

// POST /projects/:projectId/github/pull
router.post("/projects/:projectId/github/pull", async (req, res): Promise<void> => {
  const params = PullRepoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = PullRepoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const project = await getProject(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  try {
    if (project.gitRemoteUrl && body.data.token) {
      const u = new URL(project.gitRemoteUrl);
      u.username = body.data.token;
      u.password = "x-oauth-basic";
      gitOrThrow(["pull", u.toString()], project.localPath);
    } else {
      gitOrThrow(["pull"], project.localPath);
    }
    await db.update(projectsTable).set({ lastSynced: new Date(), updatedAt: new Date() }).where(eq(projectsTable.id, project.id));
    res.json(PullRepoResponse.parse({ success: true, message: "Pulled latest changes", commitHash: null }));
  } catch (err) {
    res.status(500).json(PullRepoResponse.parse({ success: false, message: String(err instanceof Error ? err.message : err), commitHash: null }));
  }
});

// GET /projects/:projectId/github/branches
router.get("/projects/:projectId/github/branches", async (req, res): Promise<void> => {
  const params = ListBranchesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const project = await getProject(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const raw = git(["branch"], project.localPath).stdout;
  const branches = raw.split("\n")
    .map(b => b.replace(/^\*?\s+/, "").trim())
    .filter(Boolean);
  const current = git(["branch", "--show-current"], project.localPath).stdout || branches[0] || "main";

  res.json(ListBranchesResponse.parse({ branches: branches.length ? branches : ["main"], current }));
});

// POST /projects/:projectId/github/checkout
router.post("/projects/:projectId/github/checkout", async (req, res): Promise<void> => {
  const params = CheckoutBranchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CheckoutBranchBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const project = await getProject(params.data.projectId, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!isValidRef(body.data.branch)) {
    res.status(400).json({ error: "Invalid branch name" });
    return;
  }

  try {
    const checkoutArgs: string[] = ["checkout"];
    if (body.data.create) checkoutArgs.push("-b");
    checkoutArgs.push(body.data.branch);
    gitOrThrow(checkoutArgs, project.localPath);
    await db.update(projectsTable).set({ currentBranch: body.data.branch, updatedAt: new Date() }).where(eq(projectsTable.id, project.id));
    res.json(CheckoutBranchResponse.parse({ success: true, message: `Switched to branch ${body.data.branch}`, commitHash: null }));
  } catch (err) {
    res.status(500).json(CheckoutBranchResponse.parse({ success: false, message: String(err instanceof Error ? err.message : err), commitHash: null }));
  }
});

export default router;
