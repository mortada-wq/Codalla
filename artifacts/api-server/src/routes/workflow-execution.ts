import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { db, workflowExecutionTable, workflowStepExecutionTable, workflowsTable, projectsTable } from "@workspace/db";
import { projectAccessWhere } from "../lib/project-access";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getProviderCreds(provider: string, userId: string) {
  // Reuse from ai.ts
  const { apiKeysTable, settingsTable } = await import("@workspace/db");
  const [key] = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.provider, provider)))
    .limit(1);
  if (key?.isActive) {
    return { apiKey: key.keyValue, baseURL: key.baseUrl ?? "https://api.siliconflow.cn/v1" };
  }
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (envKey) {
    return { apiKey: envKey, baseURL: "https://api.siliconflow.cn/v1" };
  }
  return null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /workflow-executions
// Body: { workflowId, projectId?, modelId, provider }
// Start a new workflow execution
router.post("/workflow-executions", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { workflowId, projectId, modelId, provider } = req.body;

  if (!workflowId || !modelId || !provider) {
    res.status(400).json({ error: "workflowId, modelId, and provider are required" });
    return;
  }

  try {
    // Verify workflow exists
    const [workflow] = await db.select().from(workflowsTable)
      .where(eq(workflowsTable.id, workflowId));
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    // Verify project access if provided
    if (projectId) {
      const [project] = await db.select().from(projectsTable)
        .where(projectAccessWhere(projectId, userId));
      if (!project) {
        res.status(403).json({ error: "Project not accessible" });
        return;
      }
    }

    // Create execution record
    const [execution] = await db.insert(workflowExecutionTable).values({
      id: uuidv4(),
      userId,
      projectId: projectId || null,
      workflowId,
      status: "pending",
      currentStepIndex: 0,
      context: { modelId, provider },
    }).returning();

    res.status(201).json({
      ...execution,
      createdAt: execution.createdAt.toISOString(),
      updatedAt: execution.updatedAt.toISOString(),
      completedAt: execution.completedAt?.toISOString() ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to start workflow" });
  }
});

// GET /workflow-executions/:executionId
// Get execution status and progress
router.get("/workflow-executions/:executionId", async (req, res): Promise<void> => {
  const { executionId } = req.params;

  try {
    const [execution] = await db.select().from(workflowExecutionTable)
      .where(eq(workflowExecutionTable.id, executionId));

    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    // Fetch step results
    const steps = await db.select().from(workflowStepExecutionTable)
      .where(eq(workflowStepExecutionTable.executionId, executionId));

    res.json({
      ...execution,
      createdAt: execution.createdAt.toISOString(),
      updatedAt: execution.updatedAt.toISOString(),
      completedAt: execution.completedAt?.toISOString() ?? null,
      steps: steps.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch execution" });
  }
});

// POST /workflow-executions/:executionId/step
// Execute the next step in the workflow
// Body: { currentOutput?: string }
router.post("/workflow-executions/:executionId/step", async (req, res): Promise<void> => {
  const { executionId } = req.params;
  const { currentOutput } = req.body ?? {};

  try {
    const [execution] = await db.select().from(workflowExecutionTable)
      .where(eq(workflowExecutionTable.id, executionId));

    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    if (execution.status === "completed" || execution.status === "failed") {
      res.status(400).json({ error: "Execution is already " + execution.status });
      return;
    }

    // Get the workflow
    const [workflow] = await db.select().from(workflowsTable)
      .where(eq(workflowsTable.id, execution.workflowId));

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const steps = workflow.steps as Array<{ title: string; prompt: string }> || [];
    const currentStepIndex = execution.currentStepIndex;

    if (currentStepIndex >= steps.length) {
      // All steps completed
      await db.update(workflowExecutionTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(workflowExecutionTable.id, executionId));
      res.json({ message: "Workflow completed", status: "completed" });
      return;
    }

    const currentStep = steps[currentStepIndex];

    // Get API credentials
    const creds = await getProviderCreds(execution.context.provider, execution.userId);
    if (!creds) {
      res.status(400).json({ error: "No API key configured" });
      return;
    }

    // Create step execution record
    const stepId = uuidv4();
    await db.insert(workflowStepExecutionTable).values({
      id: stepId,
      executionId,
      stepIndex: currentStepIndex,
      status: "running",
      title: currentStep.title,
      input: { previousOutput: currentOutput },
    });

    // Call the AI
    const client = new OpenAI({
      apiKey: creds.apiKey,
      baseURL: creds.baseURL,
    });

    try {
      const completion = await client.chat.completions.create({
        model: execution.context.modelId,
        messages: [
          { role: "system", content: "You are Codalla, an expert pair programmer. Provide clear, actionable output." },
          {
            role: "user",
            content: `${currentStep.prompt}\n\n${currentOutput ? `Previous context:\n${currentOutput}` : ""}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const output = completion.choices[0]?.message?.content ?? "";

      // Update step execution
      await db.update(workflowStepExecutionTable)
        .set({
          status: "completed",
          output,
          tokensUsed: (completion.usage?.prompt_tokens ?? 0) + (completion.usage?.completion_tokens ?? 0),
          cost: ((completion.usage?.prompt_tokens ?? 0) + (completion.usage?.completion_tokens ?? 0)) / 1_000_000 * 2.0,
          completedAt: new Date(),
        })
        .where(eq(workflowStepExecutionTable.id, stepId));

      // Advance execution
      const newIndex = currentStepIndex + 1;
      const isLast = newIndex >= steps.length;
      await db.update(workflowExecutionTable)
        .set({
          currentStepIndex: newIndex,
          status: isLast ? "completed" : "running",
          totalCost: (execution.totalCost ?? 0) + (completion.usage?.total_tokens ?? 0) / 1_000_000 * 2.0,
          updatedAt: new Date(),
          completedAt: isLast ? new Date() : null,
        })
        .where(eq(workflowExecutionTable.id, executionId));

      res.json({
        stepCompleted: true,
        stepIndex: currentStepIndex,
        output,
        isLastStep: isLast,
        nextStepTitle: !isLast ? steps[newIndex]?.title : null,
      });
    } catch (err: any) {
      // Mark step as failed
      await db.update(workflowStepExecutionTable)
        .set({
          status: "failed",
          error: err?.message ?? "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(workflowStepExecutionTable.id, stepId));

      await db.update(workflowExecutionTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(workflowExecutionTable.id, executionId));

      res.status(502).json({ error: `Step failed: ${err?.message ?? "Unknown error"}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to execute step" });
  }
});

export default router;
