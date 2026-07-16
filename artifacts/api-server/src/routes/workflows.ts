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
  const parsed = CreateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workflow] = await db.insert(workflowsTable).values({
    id: uuidv4(),
    userId: req.user!.id,
    name: parsed.data.name,
    isShared: parsed.data.isShared ?? false,
    description: parsed.data.description ?? null,
    steps: parsed.data.steps,
  }).returning();
  res.status(201).json(CreateWorkflowResponse.parse(fmt(workflow, req.user!.id)));
});

router.put("/workflows/:workflowId", async (req, res): Promise<void> => {
  const params = UpdateWorkflowParams.safeParse(req.params);
  const parsed = UpdateWorkflowBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: (params.success ? parsed : params).error?.message });
    return;
  }
  // Owner-only: the userId equality below is the authorization check
  const [workflow] = await db.update(workflowsTable)
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
  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.json(UpdateWorkflowResponse.parse(fmt(workflow, req.user!.id)));
});

router.delete("/workflows/:workflowId", async (req, res): Promise<void> => {
  const params = DeleteWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [workflow] = await db.delete(workflowsTable)
    .where(and(
      eq(workflowsTable.id, params.data.workflowId),
      eq(workflowsTable.userId, req.user!.id),
    ))
    .returning();
  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
