import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { projectAccessWhere } from "../lib/project-access";
import { db, projectsTable, projectAssetsTable, apiKeysTable, settingsTable, usageLogTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { classifyProblem } from "../utils/detect-stack";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"]);

function mimeFor(ext: string): string {
  const m: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".ogg": "audio/ogg", ".flac": "audio/flac", ".aac": "audio/aac",
  };
  return m[ext.toLowerCase()] ?? "application/octet-stream";
}

/** Walk a directory tree and return relative file paths, honoring an ignore list. */
function walkFiles(root: string, ignore: Set<string> = new Set([".git", "node_modules", ".next", "dist", "build"])): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(path.relative(root, full));
    }
  }
  return out;
}

/**
 * Extract `### File: \`path\`` blocks from an LLM response.
 * Matches the same convention used by the chat editor (parseFileBlocks in editor.tsx).
 */
export function parseFileBlocks(content: string): Array<{ path: string; code: string }> {
  const out: Array<{ path: string; code: string }> = [];
  const re = /###\s*File:\s*`?([^`\n]+?)`?\s*\n```[a-zA-Z0-9+_.\-]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push({ path: m[1].trim(), code: m[2] });
  }
  return out;
}

/** Prevent path traversal — output must stay inside root. */
function safeJoin(root: string, rel: string): string | null {
  const joined = path.join(root, rel);
  const normalized = path.resolve(joined);
  const normRoot = path.resolve(root);
  if (!normalized.startsWith(normRoot + path.sep) && normalized !== normRoot) return null;
  return normalized;
}

async function getProviderCreds(provider: string, userId: string): Promise<{ apiKey: string; baseURL: string } | null> {
  // Mirror of ai.ts::getActiveKey but standalone so this router doesn't couple to chat internals
  if (provider === "runpod") {
    const [s] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
    if (!s?.runpodEndpoint) return null;
    const [k] = await db.select().from(apiKeysTable)
      .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.provider, "runpod"))).limit(1);
    return {
      apiKey: k?.isActive ? k.keyValue : "none",
      baseURL: s.runpodEndpoint.replace(/\/$/, "") + "/v1",
    };
  }
  const [k] = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.provider, provider))).limit(1);
  if (k?.isActive && k.keyValue.trim().length > 0) {
    const defaultBase: Record<string, string> = {
      siliconflow: "https://api.siliconflow.cn/v1",
      openrouter: "https://openrouter.ai/api/v1",
    };
    return { apiKey: k.keyValue, baseURL: k.baseUrl ?? defaultBase[provider] ?? "" };
  }
  const envKey = provider === "siliconflow" ? process.env["SILICONFLOW_API_KEY"]
    : provider === "openrouter" ? process.env["OPENROUTER_API_KEY"] : null;
  if (envKey && envKey.length > 0) {
    return {
      apiKey: envKey,
      baseURL: provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.siliconflow.cn/v1",
    };
  }
  return null;
}

function makeClient(creds: { apiKey: string; baseURL: string }, provider: string) {
  return new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseURL,
    defaultHeaders: provider === "openrouter"
      ? { "HTTP-Referer": "https://codalla.app", "X-Title": "Codalla" }
      : undefined,
  });
}

async function getProject(projectId: string, userId: string) {
  const [p] = await db.select().from(projectsTable)
    .where(projectAccessWhere(projectId, userId));
  return p ?? null;
}

async function logUsage(userId: string, model: string, provider: string, promptTokens: number, completionTokens: number, action: string) {
  const rate = 2.0; // rough default; per-model rates live in ai.ts
  const cost = ((promptTokens + completionTokens) / 1_000_000) * rate;
  await db.insert(usageLogTable).values({
    id: uuidv4(), userId, model, provider, promptTokens, completionTokens, cost, action,
  });
}

// ═════════════════════════════════════════════════════════════════════════
// POST /projects/:projectId/generate-files
// Body: { prompt: string, modelId: string, provider: string }
// Uses the LLM to generate a set of files (### File: blocks), writes them,
// and records each in project_assets.
// ═════════════════════════════════════════════════════════════════════════
router.post("/projects/:projectId/generate-files", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { prompt, modelId, provider } = req.body ?? {};

  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    res.status(400).json({ error: "prompt must be at least 3 characters" });
    return;
  }
  if (typeof modelId !== "string" || typeof provider !== "string") {
    res.status(400).json({ error: "modelId and provider are required" });
    return;
  }

  const project = await getProject(projectId, req.user!.id);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const creds = await getProviderCreds(provider, req.user!.id);
  if (!creds) {
    res.status(400).json({ error: `No API key configured for ${provider}. Add one in Settings → API keys.` });
    return;
  }

  let client: OpenAI;
  try {
    client = makeClient(creds, provider);
  } catch (err: any) {
    res.status(400).json({ error: `Provider misconfigured: ${err?.message ?? "invalid credentials"}` });
    return;
  }

  const systemPrompt = `You are Codalla — a senior full-stack engineer building starter projects.

The user will describe a project. Output ONLY the initial files the project needs, using this exact format for EACH file:

### File: \`relative/path/to/file.ext\`
\`\`\`language
FULL file content here — never truncate, never use ellipses
\`\`\`

Rules:
- Include README.md as the first file.
- Include package.json / pyproject.toml / go.mod as appropriate.
- Include the main entry point and any obvious sibling files (index, main, config).
- Aim for 3–8 files total — enough to boot, not a full app.
- Do not include any prose outside the File blocks.
- Use forward slashes in paths.`;

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Project name: ${project.name}\n\nDescription: ${prompt}` },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message, provider, modelId }, "generate-files upstream error");
    res.status(502).json({ error: `Model returned an error: ${err?.message ?? "unknown"}` });
    return;
  }

  const content = completion.choices?.[0]?.message?.content ?? "";
  const blocks = parseFileBlocks(content);
  if (blocks.length === 0) {
    res.status(422).json({
      error: "The model didn't produce any file blocks. Try rephrasing or picking a stronger model.",
      raw: content.slice(0, 800),
    });
    return;
  }

  const writtenAssets: Array<{ path: string; sizeBytes: number }> = [];
  const skipped: string[] = [];

  for (const block of blocks) {
    const cleanRelPath = block.path.replace(/^\.\/+/, "").replace(/^\/+/, "");
    const fullPath = safeJoin(project.localPath, cleanRelPath);
    if (!fullPath) { skipped.push(block.path); continue; }
    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, block.code, "utf-8");
      const stat = fs.statSync(fullPath);
      await db.insert(projectAssetsTable).values({
        id: uuidv4(),
        projectId,
        userId: req.user!.id,
        kind: "ai-generated",
        path: cleanRelPath,
        prompt,
        model: modelId,
        provider,
        sizeBytes: stat.size,
      });
      writtenAssets.push({ path: cleanRelPath, sizeBytes: stat.size });
    } catch (err) {
      logger.warn({ err, path: block.path }, "Failed to write generated file");
      skipped.push(block.path);
    }
  }

  const usage = completion.usage;
  if (usage) {
    await logUsage(
      req.user!.id, modelId, provider,
      usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0,
      "generate-files",
    );
  }

  res.json({
    filesWritten: writtenAssets,
    filesSkipped: skipped,
    filesTotal: blocks.length,
  });
});

// ═════════════════════════════════════════════════════════════════════════
// POST /projects/:projectId/analyze-media
// Body: { type: 'images' | 'audio' | 'both', modelId, provider, instructions? }
// Scans the project for media files, describes each using the model,
// writes the descriptions into CODALLA_MEDIA.md and per-file .md siblings.
// ═════════════════════════════════════════════════════════════════════════
router.post("/projects/:projectId/analyze-media", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { type, modelId, provider, instructions } = req.body ?? {};
  if (!["images", "audio", "both"].includes(type)) {
    res.status(400).json({ error: "type must be 'images', 'audio', or 'both'" });
    return;
  }
  if (typeof modelId !== "string" || typeof provider !== "string") {
    res.status(400).json({ error: "modelId and provider are required" });
    return;
  }

  const project = await getProject(projectId, req.user!.id);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const creds = await getProviderCreds(provider, req.user!.id);
  if (!creds) {
    res.status(400).json({ error: `No API key configured for ${provider}.` });
    return;
  }

  // Scan project for candidate files
  const allFiles = walkFiles(project.localPath);
  const candidates = allFiles.filter(rel => {
    const ext = path.extname(rel).toLowerCase();
    if (type === "images" || type === "both") { if (IMAGE_EXTS.has(ext)) return true; }
    if (type === "audio" || type === "both")  { if (AUDIO_EXTS.has(ext)) return true; }
    return false;
  });

  if (candidates.length === 0) {
    res.json({
      results: [],
      message: type === "images"
        ? "No image files found in this project."
        : type === "audio"
          ? "No audio files found in this project."
          : "No image or audio files found in this project.",
    });
    return;
  }

  let client: OpenAI;
  try {
    client = makeClient(creds, provider);
  } catch (err: any) {
    res.status(400).json({ error: `Provider misconfigured: ${err?.message ?? "invalid credentials"}` });
    return;
  }

  const results: Array<{ path: string; description?: string; error?: string }> = [];
  for (const relPath of candidates) {
    const fullPath = safeJoin(project.localPath, relPath);
    if (!fullPath) continue;
    const ext = path.extname(relPath).toLowerCase();
    const mime = mimeFor(ext);
    const isImage = IMAGE_EXTS.has(ext);

    try {
      const stat = fs.statSync(fullPath);
      // Cap at 12 MB — most vision APIs reject larger anyway
      if (stat.size > 12 * 1024 * 1024) {
        results.push({ path: relPath, error: "File too large (>12 MB)" });
        continue;
      }
      const buffer = fs.readFileSync(fullPath);
      const base64 = buffer.toString("base64");

      const userInstructions = (typeof instructions === "string" && instructions.trim().length > 0)
        ? instructions.trim()
        : isImage
          ? "Describe this image in detail: subject, composition, style, colors, notable elements, and any text visible. Keep it to 4–6 sentences."
          : "Provide a musicology-informed description of this audio: genre, tempo (BPM if identifiable), instrumentation, mood, structure, notable production choices, and any lyrics/language you can detect. Keep it to 5–8 sentences.";

      const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = isImage
        ? [
            { type: "text", text: userInstructions },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ]
        : [
            { type: "text", text: `File: ${relPath}\n\n${userInstructions}` },
            // OpenAI-compatible audio input; providers without audio support will 400 here (we surface the error per file)
            ({ type: "input_audio", input_audio: { data: base64, format: ext.replace(".", "") } } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart),
          ];

      const completion = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: "system", content: "You are Codalla's media analyst. Be concise, specific, and technical." },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const description = completion.choices?.[0]?.message?.content?.trim() ?? "";
      if (!description) {
        results.push({ path: relPath, error: "Empty response from model" });
        continue;
      }

      // Write to a sibling .md file (relPath + ".md")
      const outRelPath = relPath + ".md";
      const outFullPath = safeJoin(project.localPath, outRelPath);
      if (outFullPath) {
        fs.mkdirSync(path.dirname(outFullPath), { recursive: true });
        const header = `# ${relPath}\n\n_${isImage ? "Image" : "Audio"} description generated by ${modelId} · ${new Date().toISOString()}_\n\n`;
        fs.writeFileSync(outFullPath, header + description + "\n", "utf-8");
        const stat2 = fs.statSync(outFullPath);
        await db.insert(projectAssetsTable).values({
          id: uuidv4(),
          projectId,
          userId: req.user!.id,
          kind: "media-description",
          path: outRelPath,
          sourcePath: relPath,
          sourceMimeType: mime,
          prompt: userInstructions,
          model: modelId,
          provider,
          sizeBytes: stat2.size,
        });
      }

      if (completion.usage) {
        await logUsage(
          req.user!.id, modelId, provider,
          completion.usage.prompt_tokens ?? 0,
          completion.usage.completion_tokens ?? 0,
          isImage ? "analyze-image" : "analyze-audio",
        );
      }

      results.push({ path: relPath, description });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const isCapability = /image_url|input_audio|multimodal|vision|not supported/i.test(msg);
      results.push({
        path: relPath,
        error: isCapability
          ? `Model doesn't support this media type. Try Claude 3.5 Sonnet, GPT-4o, or Gemini for images.`
          : msg,
      });
    }
  }

  // Write a rolled-up index
  const successes = results.filter(r => r.description);
  if (successes.length > 0) {
    const indexPath = safeJoin(project.localPath, "CODALLA_MEDIA.md");
    if (indexPath) {
      const lines = [
        "# Media descriptions",
        "",
        `_Generated by ${modelId} · ${new Date().toISOString()}_`,
        "",
        ...successes.flatMap(r => [`## ${r.path}`, "", r.description!, ""]),
      ];
      fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
    }
  }

  res.json({
    results,
    scanned: candidates.length,
    described: successes.length,
    failed: results.length - successes.length,
  });
});

// ═════════════════════════════════════════════════════════════════════════
// POST /projects/:projectId/analyze-file-real-time
// Body: { code: string, filename?: string, language?: string, modelId, provider }
// Analyzes a single file for AI development issues in real-time.
// Returns a list of issues with severity, description, and suggested fixes.
// ═════════════════════════════════════════════════════════════════════════
router.post("/projects/:projectId/analyze-file-real-time", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { code, filename, language, modelId, provider } = req.body ?? {};

  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "code is required and must not be empty" });
    return;
  }
  if (typeof modelId !== "string" || typeof provider !== "string") {
    res.status(400).json({ error: "modelId and provider are required" });
    return;
  }

  const project = await getProject(projectId, req.user!.id);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const creds = await getProviderCreds(provider, req.user!.id);
  if (!creds) {
    res.status(400).json({ error: `No API key configured for ${provider}.` });
    return;
  }

  let client: OpenAI;
  try {
    client = makeClient(creds, provider);
  } catch (err: any) {
    res.status(400).json({ error: `Provider misconfigured: ${err?.message ?? "invalid credentials"}` });
    return;
  }

  const analysisPrompt = `You are a senior code reviewer specialized in AI/ML development. Analyze this ${language || "code"} for common issues and anti-patterns, especially in the context of AI app development (LLM APIs, embeddings, data pipelines, prompt engineering, etc.).

For each issue found, respond ONLY with JSON array (no markdown, no explanation):
[
  {
    "line": <estimated line number or null>,
    "severity": "error" | "warning" | "info",
    "issue": "<short issue description>",
    "fix": "<suggested fix or improvement>"
  }
]

Look for:
- Missing or incorrect API calls (OpenAI, Anthropic, etc.)
- Type mismatches, especially with embeddings or vectors
- Unhandled async/await issues
- Missing error handling
- Prompt injection vulnerabilities
- Token limit overflows
- Data validation gaps
- Memory leaks or resource cleanup issues
- Performance bottlenecks (e.g., sequential API calls that could be batched)

If no issues found, return: []`;

  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: analysisPrompt },
        {
          role: "user",
          content: filename
            ? `File: ${filename}\n\n\`\`\`${language || ""}\n${code}\n\`\`\``
            : `\`\`\`${language || ""}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const responseText = completion.choices?.[0]?.message?.content ?? "[]";
    let issues: any[] = [];

    try {
      // Try to parse JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        issues = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, return empty issues list and log the raw response
      logger.warn({ response: responseText }, "Failed to parse analysis response as JSON");
    }

    if (completion.usage) {
      await logUsage(
        req.user!.id, modelId, provider,
        completion.usage.prompt_tokens ?? 0,
        completion.usage.completion_tokens ?? 0,
        "analyze-file-real-time",
      );
    }

    res.json({
      issues: Array.isArray(issues) ? issues : [],
      filename: filename || "untitled",
    });
  } catch (err: any) {
    logger.warn({ err: err?.message, provider, modelId }, "analyze-file-real-time upstream error");
    res.status(502).json({
      error: `Analysis failed: ${err?.message ?? "unknown error"}`,
      issues: [],
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /projects/:projectId/classify-problem
// Body: { codeSnippet: string, projectName?: string }
// Classifies a problem type based on code snippet and context.
// Returns { type: "prompt" | "data-pipeline" | "model-integration" | "fine-tuning" | "general" }
// ═════════════════════════════════════════════════════════════════════════
router.post("/projects/:projectId/classify-problem", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { codeSnippet, projectName } = req.body ?? {};

  if (typeof codeSnippet !== "string" || codeSnippet.trim().length === 0) {
    res.status(400).json({ error: "codeSnippet is required" });
    return;
  }

  try {
    const classification = classifyProblem(codeSnippet, undefined, projectName);
    res.json({
      type: classification.type,
      confidence: classification.confidence,
      indicators: classification.indicators,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "classify-problem error");
    res.status(500).json({ error: "Classification failed", type: "general" });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /projects/:projectId/assets — list every AI-generated asset for a project
// ═════════════════════════════════════════════════════════════════════════
router.get("/projects/:projectId/assets", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const project = await getProject(projectId, req.user!.id);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const assets = await db.select().from(projectAssetsTable)
    .where(and(eq(projectAssetsTable.projectId, projectId), eq(projectAssetsTable.userId, req.user!.id)))
    .orderBy(projectAssetsTable.createdAt);
  res.json(assets.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

export default router;
