import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import {
  GetFileTreeParams,
  GetFileTreeResponse,
  SaveFileParams,
  SaveFileBody,
  SaveFileResponse,
  GetFileQueryParams,
  GetFileResponse,
  DeleteFileQueryParams,
  CreateDirectoryParams,
  CreateDirectoryBody,
  CreateDirectoryResponse,
  RenameFileParams,
  RenameFileBody,
  RenameFileResponse,
  ApplyFileParams,
  ApplyFileBody,
  ApplyFileResponse,
} from "@workspace/api-zod";
import fs from "fs";
import path from "path";

const router: IRouter = Router();

// Detect language from file extension
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java", ".c": "c", ".cpp": "cpp",
    ".cs": "csharp", ".rb": "ruby", ".php": "php", ".swift": "swift", ".kt": "kotlin",
    ".html": "html", ".css": "css", ".scss": "scss", ".less": "less",
    ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
    ".md": "markdown", ".sh": "shell", ".bash": "shell", ".sql": "sql",
    ".xml": "xml", ".graphql": "graphql", ".gql": "graphql",
    ".env": "plaintext", ".txt": "plaintext", ".log": "plaintext",
    ".vue": "vue", ".svelte": "svelte",
  };
  return map[ext] || "plaintext";
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number | null;
  children?: FileNode[] | null;
};

function buildFileTree(dirPath: string, relativePath: string = ""): FileNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip hidden files/dirs except .gitignore, .env
    if (entry.name.startsWith(".") && !["gitignore", "env", "env.example"].includes(entry.name.replace(".", ""))) {
      continue;
    }
    // Skip node_modules, __pycache__, .git
    if (["node_modules", "__pycache__", ".git", "dist", "build", ".next"].includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "directory",
        children: buildFileTree(fullPath, relPath),
      });
    } else {
      const stat = fs.statSync(fullPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "file",
        size: stat.size,
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function getProjectPath(projectId: string, userId: string): Promise<string | null> {
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return project?.localPath ?? null;
}

function safePath(base: string, relativePath: string): string | null {
  const normalizedBase = path.resolve(base);
  const resolved = path.resolve(normalizedBase, relativePath);
  // Require resolved path to equal base OR start with base + separator to prevent sibling traversal
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    return null;
  }
  return resolved;
}

// GET /projects/:projectId/tree
router.get("/projects/:projectId/tree", async (req, res): Promise<void> => {
  const params = GetFileTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const localPath = await getProjectPath(params.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  const nodes = buildFileTree(localPath);
  res.json(GetFileTreeResponse.parse({ projectId: params.data.projectId, nodes }));
});

// GET /file-contents?projectId=&filePath=
router.get("/file-contents", async (req, res): Promise<void> => {
  const parsed = GetFileQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const localPath = await getProjectPath(parsed.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const filePath = safePath(localPath, parsed.data.filePath);
  if (!filePath) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const stat = fs.statSync(filePath);

  res.json(GetFileResponse.parse({
    path: parsed.data.filePath,
    content,
    language: detectLanguage(parsed.data.filePath),
    size: stat.size,
  }));
});

// DELETE /file-contents?projectId=&filePath=
router.delete("/file-contents", async (req, res): Promise<void> => {
  const parsed = DeleteFileQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const localPath = await getProjectPath(parsed.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const filePath = safePath(localPath, parsed.data.filePath);
  if (!filePath) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(filePath);
  }

  res.sendStatus(204);
});

// PUT /projects/:projectId/files
router.put("/projects/:projectId/files", async (req, res): Promise<void> => {
  const params = SaveFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SaveFileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const localPath = await getProjectPath(params.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const filePath = safePath(localPath, body.data.path);
  if (!filePath) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body.data.content, "utf-8");
  const stat = fs.statSync(filePath);

  res.json(SaveFileResponse.parse({
    path: body.data.path,
    content: body.data.content,
    language: detectLanguage(body.data.path),
    size: stat.size,
  }));
});

// POST /projects/:projectId/directories
router.post("/projects/:projectId/directories", async (req, res): Promise<void> => {
  const params = CreateDirectoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateDirectoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const localPath = await getProjectPath(params.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const dirPath = safePath(localPath, body.data.path);
  if (!dirPath) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  fs.mkdirSync(dirPath, { recursive: true });
  const nodes = buildFileTree(localPath);
  res.status(201).json(CreateDirectoryResponse.parse({ projectId: params.data.projectId, nodes }));
});

// POST /projects/:projectId/apply-file  — AI-proposed file write
router.post("/projects/:projectId/apply-file", async (req, res): Promise<void> => {
  const params = ApplyFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ApplyFileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const localPath = await getProjectPath(params.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const filePath = safePath(localPath, body.data.path);
  if (!filePath) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body.data.content, "utf-8");
  const stat = fs.statSync(filePath);

  res.json(ApplyFileResponse.parse({
    path: body.data.path,
    content: body.data.content,
    language: detectLanguage(body.data.path),
    size: stat.size,
  }));
});

// POST /projects/:projectId/rename
router.post("/projects/:projectId/rename", async (req, res): Promise<void> => {
  const params = RenameFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RenameFileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const localPath = await getProjectPath(params.data.projectId, req.user!.id);
  if (!localPath) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const oldPath = safePath(localPath, body.data.oldPath);
  const newPath = safePath(localPath, body.data.newPath);
  if (!oldPath || !newPath) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  if (!fs.existsSync(oldPath)) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  fs.mkdirSync(path.dirname(newPath), { recursive: true });
  fs.renameSync(oldPath, newPath);

  const nodes = buildFileTree(localPath);
  res.json(RenameFileResponse.parse({ projectId: params.data.projectId, nodes }));
});

export default router;
