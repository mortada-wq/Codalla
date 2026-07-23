import { Router, type IRouter } from "express";
import { and, eq, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, workflowsTable } from "@workspace/db";
import {
  ListWorkflowsResponse,
  CreateWorkflowBody,
  CreateWorkflowResponse,
  UpdateWorkflowParams,
  UpdateWorkflowBody,
  UpdateWorkflowResponse,
  DeleteWorkflowParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function fmt(w: typeof workflowsTable.$inferSelect, userId: string) {
  return {
    ...w,
    isOwner: w.userId === userId,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

router.get("/workflows", async (req, res): Promise<void> => {
  // Own presets plus anything a teammate shared with the team
  const workflows = await db.select().from(workflowsTable)
    .where(or(eq(workflowsTable.userId, req.user!.id), eq(workflowsTable.isShared, true)))
    .orderBy(workflowsTable.createdAt);
  res.json(ListWorkflowsResponse.parse(workflows.map((w) => fmt(w, req.user!.id))));
});

router.post("/workflows", async (req, res): Promise<void> => {
  try {
    const parsed = CreateWorkflowBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const result = await db.insert(workflowsTable).values({
      id: uuidv4(),
      userId: req.user!.id,
      name: parsed.data.name,
      isShared: parsed.data.isShared ?? false,
      description: parsed.data.description ?? null,
      steps: parsed.data.steps,
    }).returning();
    const workflow = result[0];
    if (!workflow) {
      logger.error("Workflow insert returned empty result");
      res.status(500).json({ error: "Failed to create workflow: database error" });
      return;
    }
    res.status(201).json(CreateWorkflowResponse.parse(fmt(workflow, req.user!.id)));
  } catch (err) {
    logger.error({ err, body: req.body }, "Error creating workflow");
    throw err;
  }
});

router.put("/workflows/:workflowId", async (req, res): Promise<void> => {
  try {
    const params = UpdateWorkflowParams.safeParse(req.params);
    const parsed = UpdateWorkflowBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: (params.success ? parsed : params).error?.message });
      return;
    }
    const result = await db.update(workflowsTable)
      .set({
        name: parsed.data.name,
        isShared: parsed.data.isShared ?? false,
        description: parsed.data.description ?? null,
        steps: parsed.data.steps,
        updatedAt: new Date(),
      })
      .where(and(
        eq(workflowsTable.id, params.data.workflowId),
        eq(workflowsTable.userId, req.user!.id),
      ))
      .returning();
    const workflow = result[0];
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(UpdateWorkflowResponse.parse(fmt(workflow, req.user!.id)));
  } catch (err) {
    logger.error({ err }, "Error updating workflow");
    throw err;
  }
});

router.delete("/workflows/:workflowId", async (req, res): Promise<void> => {
  try {
    const params = DeleteWorkflowParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const result = await db.delete(workflowsTable)
      .where(and(
        eq(workflowsTable.id, params.data.workflowId),
        eq(workflowsTable.userId, req.user!.id),
      ))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    logger.error({ err }, "Error deleting workflow");
    throw err;
  }
});

export default router;
