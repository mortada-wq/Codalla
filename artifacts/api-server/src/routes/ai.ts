import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, apiKeysTable, conversationsTable, messagesTable, usageLogTable, settingsTable, projectsTable, projectSuccessCriteriaTable, projectMemoryNotesTable } from "@workspace/db";
import { detectProjectStack, buildSystemPrompt } from "../utils/detect-stack";
import {
  ListModelsResponse,
  CreateConversationBody,
  CreateConversationResponse,
  GetConversationParams,
  GetConversationResponse,
  DeleteConversationParams,
  ListConversationsQueryParams,
  ListConversationsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  SendChatMessageBody,
  SendChatMessageResponse,
  RunCodeActionBody,
  RunCodeActionResponse,
} from "@workspace/api-zod";
import { and, asc, desc } from "drizzle-orm";
import OpenAI from "openai";

const router: IRouter = Router();

// ── Provider config ──────────────────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<string, { baseURL: string }> = {
  siliconflow: { baseURL: "https://api.siliconflow.cn/v1" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1" },
  // runpod baseURL is dynamic — comes from settingsTable.runpodEndpoint + "/v1"
};

const BUILT_IN_MODELS = [
  // ── RunPod (self-hosted) ─────────────────────────────────────────────────
  { id: "deepseek-coder-33b", name: "DeepSeek Coder 33B (RunPod)", provider: "runpod", contextLength: 16384, description: "Self-hosted via RunPod TGI" },
  { id: "tgi-hosted", name: "TGI Hosted Model (RunPod)", provider: "runpod", contextLength: 32768, description: "Whatever model is running on your pod" },
  // ── SiliconFlow ──────────────────────────────────────────────────────────
  { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3", provider: "siliconflow", contextLength: 65536, description: "Fast, capable coding model" },
  { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", provider: "siliconflow", contextLength: 65536, description: "Reasoning model" },
  { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen2.5 Coder 32B", provider: "siliconflow", contextLength: 32768, description: "Specialized code model" },
  // ── OpenRouter ───────────────────────────────────────────────────────────
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (Free)", provider: "openrouter", contextLength: 65536, description: "Free tier via OpenRouter" },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B (Free)", provider: "openrouter", contextLength: 32768, description: "Google Gemma 3 27B via OpenRouter" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "openrouter", contextLength: 200000, description: "Anthropic via OpenRouter" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openrouter", contextLength: 128000, description: "OpenAI via OpenRouter" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)", provider: "openrouter", contextLength: 65536, description: "Meta Llama via OpenRouter" },
];

async function getActiveKey(provider: string, userId: string): Promise<{ apiKey: string; baseURL: string } | null> {
  // ── RunPod: endpoint comes from settings, key from DB (any value works with TGI) ──
  if (provider === "runpod") {
    const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
    const endpoint = settings?.runpodEndpoint;
    if (!endpoint) return null;

    const baseURL = endpoint.replace(/\/$/, "") + "/v1";

    const [dbKey] = await db.select().from(apiKeysTable)
      .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.provider, "runpod")))
      .limit(1);
    const apiKey = dbKey?.isActive && dbKey.keyValue ? dbKey.keyValue : "none";

    return { apiKey, baseURL };
  }

  // ── Standard providers: check DB keys first ─────────────────────────────
  const [dbKey] = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.provider, provider)))
    .limit(1);

  if (dbKey?.isActive) {
    const baseURL = dbKey.baseUrl ?? PROVIDER_DEFAULTS[provider]?.baseURL ?? "";
    return { apiKey: dbKey.keyValue, baseURL };
  }

  // ── Fall back to env vars ────────────────────────────────────────────────
  const envKey = provider === "siliconflow"
    ? process.env["SILICONFLOW_API_KEY"]
    : provider === "openrouter"
      ? process.env["OPENROUTER_API_KEY"]
      : null;

  if (envKey) {
    return { apiKey: envKey, baseURL: PROVIDER_DEFAULTS[provider]?.baseURL ?? "" };
  }

  // ── Try custom provider keys from DB ────────────────────────────────────
  const [customKey] = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.provider, "custom")))
    .limit(1);

  if (customKey?.isActive) {
    return { apiKey: customKey.keyValue, baseURL: customKey.baseUrl ?? "" };
  }

  return null;
}

async function createOpenAIClient(provider: string, userId: string) {
  const creds = await getActiveKey(provider, userId);
  if (!creds) return null;

  return new OpenAI({
    apiKey: creds.apiKey,
    baseURL: creds.baseURL,
    defaultHeaders: provider === "openrouter"
      ? { "HTTP-Referer": "https://codalla.app", "X-Title": "Codalla" }
      : undefined,
  });
}

// ── Project context ───────────────────────────────────────────────────────────

async function getAutoSystemPrompt(projectId: string | null | undefined, userId: string): Promise<string> {
  const fallback = `You are Codalla — an expert software engineer and pair programmer.

When proposing file changes, format each file exactly like this so the editor can apply them with one click:

### File: \`relative/path/to/file.ext\`
\`\`\`language
FULL file content here — no ellipses or truncation
\`\`\`

Rules: always include the complete file content; use forward slashes; you may include multiple File blocks per reply.`;

  if (!projectId) return fallback;

  try {
    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
    if (!project) return fallback;

    const stack = detectProjectStack(project.localPath);

    const criteria = await db.select()
      .from(projectSuccessCriteriaTable)
      .where(eq(projectSuccessCriteriaTable.projectId, projectId));

    const memoryNotes = await db.select()
      .from(projectMemoryNotesTable)
      .where(eq(projectMemoryNotesTable.projectId, projectId));

    return buildSystemPrompt({
      projectName: project.name,
      stack,
      story: project.story,
      target: project.target,
      criteria: criteria.map(c => ({ label: c.label, done: c.done ?? false })),
      memoryNotes: memoryNotes.map(n => ({ title: n.title, content: n.content })),
    });
  } catch {
    return fallback;
  }
}

async function logUsage(userId: string, model: string, provider: string, promptTokens: number, completionTokens: number, action: string) {
  const costPer1M: Record<string, number> = {
    "deepseek-ai/DeepSeek-V3": 1.33,
    "deepseek-ai/DeepSeek-R1": 4.0,
    "Qwen/Qwen2.5-Coder-32B-Instruct": 1.5,
  };
  const rate = costPer1M[model] ?? 2.0;
  const cost = ((promptTokens + completionTokens) / 1_000_000) * rate;

  await db.insert(usageLogTable).values({
    id: uuidv4(),
    userId,
    model,
    provider,
    promptTokens,
    completionTokens,
    cost,
    action,
  });
  return cost;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /ai/models
router.get("/ai/models", async (req, res): Promise<void> => {
  res.json(ListModelsResponse.parse(BUILT_IN_MODELS));
});

// GET /conversations
router.get("/conversations", async (req, res): Promise<void> => {
  const parsed = ListConversationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db.select({
    id: conversationsTable.id,
    projectId: conversationsTable.projectId,
    title: conversationsTable.title,
    modelId: conversationsTable.modelId,
    provider: conversationsTable.provider,
    totalCost: conversationsTable.totalCost,
    createdAt: conversationsTable.createdAt,
    updatedAt: conversationsTable.updatedAt,
  }).from(conversationsTable)
    .where(eq(conversationsTable.userId, req.user!.id))
    .orderBy(desc(conversationsTable.updatedAt));

  // Filter by projectId if provided
  const filtered = parsed.data.projectId
    ? rows.filter(r => r.projectId === parsed.data.projectId)
    : rows;

  // Get message count per conversation
  const withCounts = await Promise.all(filtered.map(async (c) => {
    const msgs = await db.select({ id: messagesTable.id }).from(messagesTable).where(eq(messagesTable.conversationId, c.id));
    return {
      ...c,
      messageCount: msgs.length,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }));

  res.json(ListConversationsResponse.parse(withCounts));
});

// POST /conversations
router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.insert(conversationsTable).values({
    id: uuidv4(),
    userId: req.user!.id,
    projectId: parsed.data.projectId ?? null,
    title: parsed.data.title ?? null,
    modelId: parsed.data.modelId,
    provider: parsed.data.provider,
    totalCost: 0,
  }).returning();

  res.status(201).json(CreateConversationResponse.parse({
    ...conv,
    messageCount: 0,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  }));
});

// GET /conversations/:conversationId
router.get("/conversations/:conversationId", async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, params.data.conversationId), eq(conversationsTable.userId, req.user!.id)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(asc(messagesTable.createdAt));

  res.json(GetConversationResponse.parse({
    ...conv,
    messages: messages.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: conv.createdAt.toISOString(),
  }));
});

// DELETE /conversations/:conversationId
router.delete("/conversations/:conversationId", async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db.delete(conversationsTable).where(and(eq(conversationsTable.id, params.data.conversationId), eq(conversationsTable.userId, req.user!.id))).returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

// GET /conversations/:conversationId/messages
router.get("/conversations/:conversationId/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(asc(messagesTable.createdAt));

  res.json(ListMessagesResponse.parse(messages.map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }))));
});

// POST /ai/chat
router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { conversationId, content, modelId, provider, context, systemPrompt } = parsed.data;

  // Verify conversation exists
  const [conv] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.userId, req.user!.id)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Save user message
  const [userMsg] = await db.insert(messagesTable).values({
    id: uuidv4(),
    conversationId,
    role: "user",
    content,
  }).returning();

  // Load conversation history
  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));

  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  // Always build a project-aware base system prompt from the project's stack, story, and memory
  const autoPrompt = await getAutoSystemPrompt(conv.projectId, req.user!.id);
  messages.push({ role: "system", content: autoPrompt });

  // If the frontend sent additional context (e.g. memory notes toggle), add it on top
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  if (context) {
    messages.push({ role: "system", content: `Current file context:\n\`\`\`\n${context}\n\`\`\`` });
  }

  for (const m of history) {
    if (m.role === "user" || m.role === "assistant") {
      messages.push({ role: m.role as "user" | "assistant", content: m.content });
    }
  }

  const client = await createOpenAIClient(provider, req.user!.id);
  if (!client) {
    // Return a helpful error message as an assistant response
    const [assistantMsg] = await db.insert(messagesTable).values({
      id: uuidv4(),
      conversationId,
      role: "assistant",
      content: `No API key configured for provider "${provider}". Please add your API key in the API Keys section.`,
    }).returning();
    res.json(SendChatMessageResponse.parse({ ...assistantMsg, createdAt: assistantMsg.createdAt.toISOString() }));
    return;
  }

  const completion = await client.chat.completions.create({
    model: modelId,
    messages,
    temperature: 0.3,
  });

  const responseContent = completion.choices[0]?.message?.content ?? "";
  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;

  const cost = await logUsage(req.user!.id, modelId, provider, promptTokens, completionTokens, "chat");

  // Save assistant message
  const [assistantMsg] = await db.insert(messagesTable).values({
    id: uuidv4(),
    conversationId,
    role: "assistant",
    content: responseContent,
    tokensUsed: promptTokens + completionTokens,
    cost,
  }).returning();

  // Update conversation cost + updatedAt
  await db.update(conversationsTable)
    .set({ totalCost: (conv.totalCost ?? 0) + cost, updatedAt: new Date() })
    .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.userId, req.user!.id)));

  res.json(SendChatMessageResponse.parse({
    ...assistantMsg,
    createdAt: assistantMsg.createdAt.toISOString(),
  }));
});

// POST /ai/action
router.post("/ai/action", async (req, res): Promise<void> => {
  const parsed = RunCodeActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { action, code, language, filename, modelId, provider, context, conversationId } = parsed.data;

  const actionPrompts: Record<string, string> = {
    fix: `You are a code debugging assistant. Analyze the following ${language || "code"} and fix all bugs, errors, and issues. Return the fixed code and a brief explanation of what was wrong.`,
    explain: `You are a code explanation assistant. Explain the following ${language || "code"} clearly and concisely. Describe what it does, how it works, and any notable patterns or techniques used.`,
    tests: `You are a test-writing assistant. Write comprehensive unit tests for the following ${language || "code"}. Cover edge cases, happy paths, and error conditions.`,
    optimize: `You are a code optimization assistant. Analyze the following ${language || "code"} and optimize it for performance, readability, and best practices. Explain the key improvements made.`,
    document: `You are a documentation assistant. Add comprehensive JSDoc/docstring comments to the following ${language || "code"} and explain the overall purpose and usage.`,
  };

  const systemPrompt = actionPrompts[action] ?? actionPrompts["fix"];

  const userMessage = [
    filename ? `File: ${filename}` : "",
    context ? `Context:\n${context}` : "",
    `\`\`\`${language ?? ""}\n${code}\n\`\`\``,
    action === "fix" ? "\n\nProvide the complete fixed code and explain what issues you found and fixed." :
    action === "tests" ? "\n\nProvide the complete test file." :
    action === "optimize" ? "\n\nProvide the optimized code and explain the improvements." :
    action === "document" ? "\n\nProvide the fully documented code." : "",
  ].filter(Boolean).join("\n");

  const client = await createOpenAIClient(provider, req.user!.id);
  if (!client) {
    res.json(RunCodeActionResponse.parse({
      action,
      explanation: `No API key configured for provider "${provider}". Please add your API key in the API Keys section.`,
      suggestedCode: null,
      diff: null,
      tokensUsed: 0,
      cost: 0,
    }));
    return;
  }

  const completion = await client.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: action === "explain" ? 0.4 : 0.1,
  });

  const responseContent = completion.choices[0]?.message?.content ?? "";
  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;

  const cost = await logUsage(req.user!.id, modelId, provider, promptTokens, completionTokens, action);

  // Extract code block from response
  const codeBlockMatch = responseContent.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
  const suggestedCode = codeBlockMatch ? codeBlockMatch[1] : null;

  // Generate a simple line diff
  let diff: string | null = null;
  if (suggestedCode && (action === "fix" || action === "optimize" || action === "document")) {
    const originalLines = code.split("\n");
    const newLines = suggestedCode.split("\n");
    const diffLines: string[] = ["--- original", "+++ suggested"];
    const maxLen = Math.max(originalLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const orig = originalLines[i];
      const newL = newLines[i];
      if (orig === undefined) {
        diffLines.push(`+${newL}`);
      } else if (newL === undefined) {
        diffLines.push(`-${orig}`);
      } else if (orig !== newL) {
        diffLines.push(`-${orig}`);
        diffLines.push(`+${newL}`);
      } else {
        diffLines.push(` ${orig}`);
      }
    }
    diff = diffLines.join("\n");
  }

  // Optionally save to conversation
  if (conversationId) {
    await db.insert(messagesTable).values({
      id: uuidv4(),
      conversationId,
      role: "assistant",
      content: responseContent,
      tokensUsed: promptTokens + completionTokens,
      cost,
    });
  }

  res.json(RunCodeActionResponse.parse({
    action,
    explanation: responseContent,
    suggestedCode,
    diff,
    tokensUsed: promptTokens + completionTokens,
    cost,
  }));
});

// POST /ai/chat/stream — SSE streaming chat
router.post("/ai/chat/stream", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { conversationId, content, modelId, provider, context, systemPrompt } = parsed.data;

  // Set SSE headers before any async work
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();

  // Track client disconnect — used to abort the upstream LLM stream
  let clientGone = false;
  req.on("close", () => { clientGone = true; });

  const send = (data: object): boolean => {
    if (clientGone) return false;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  };

  // Wrap entire handler so errors after flushHeaders() still produce a terminal SSE event
  try {
    const [conv] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.userId, req.user!.id)));
    if (!conv) {
      send({ error: "Conversation not found" });
      res.end();
      return;
    }

    // Save user message
    await db.insert(messagesTable).values({
      id: uuidv4(),
      conversationId,
      role: "user",
      content,
    });

    // Build message history
    const history = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt));

    const msgs: OpenAI.ChatCompletionMessageParam[] = [];

    // Always build a project-aware base system prompt from the project's stack, story, and memory
    const autoPrompt = await getAutoSystemPrompt(conv.projectId, req.user!.id);
    msgs.push({ role: "system", content: autoPrompt });

    // If the frontend sent additional context (e.g. memory notes toggle), add it on top
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    if (context) msgs.push({ role: "system", content: `Current file context:\n\`\`\`\n${context}\n\`\`\`` });
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        msgs.push({ role: m.role as "user" | "assistant", content: m.content });
      }
    }

    const client = await createOpenAIClient(provider, req.user!.id);
    if (!client) {
      const msg = `No API key configured for provider "${provider}". Please add your API key in the API Keys section.`;
      const [assistantMsg] = await db.insert(messagesTable).values({
        id: uuidv4(), conversationId, role: "assistant", content: msg,
      }).returning();
      send({ content: msg, done: true, messageId: assistantMsg.id });
      res.end();
      return;
    }

    const stream = await client.chat.completions.create({
      model: modelId,
      messages: msgs,
      temperature: 0.3,
      stream: true,
    });

    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      // Abort iteration if browser disconnected to stop wasting tokens
      if (clientGone) {
        stream.controller.abort();
        break;
      }
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullContent += delta;
        send({ content: delta });
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    // Only persist and notify if we got meaningful content
    if (fullContent && !clientGone) {
      const cost = await logUsage(req.user!.id, modelId, provider, promptTokens, completionTokens, "chat");
      const [assistantMsg] = await db.insert(messagesTable).values({
        id: uuidv4(),
        conversationId,
        role: "assistant",
        content: fullContent,
        tokensUsed: promptTokens + completionTokens,
        cost,
      }).returning();
      await db.update(conversationsTable)
        .set({ totalCost: (conv.totalCost ?? 0) + cost, updatedAt: new Date() })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.userId, req.user!.id)));
      send({ done: true, messageId: assistantMsg.id, tokensUsed: promptTokens + completionTokens, cost });
    }
  } catch (err: any) {
    // Best-effort terminal error event — client may already be gone
    if (!clientGone) send({ error: err.message ?? "AI request failed" });
  } finally {
    res.end();
  }
});

export default router;
