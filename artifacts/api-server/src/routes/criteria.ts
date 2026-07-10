import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, projectsTable, projectSuccessCriteriaTable } from "@workspace/db";
import {
  ListCriteriaParams,
  ListCriteriaResponse,
  CreateCriterionParams,
  CreateCriterionBody,
  CreateCriterionResponse,
  UpdateCriterionParams,
  UpdateCriterionBody,
  UpdateCriterionResponse,
  DeleteCriterionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function projectExists(projectId: string, userId: string): Promise<boolean> {
  const [p] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return !!p;
}

function formatCriterion(c: typeof projectSuccessCriteriaTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// GET /projects/:projectId/criteria
router.get("/projects/:projectId/criteria", async (req, res): Promise<void> => {
  const params = ListCriteriaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await projectExists(params.data.projectId, req.user!.id))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const rows = await db.select()
    .from(projectSuccessCriteriaTable)
    .where(eq(projectSuccessCriteriaTable.projectId, params.data.projectId))
    .orderBy(asc(projectSuccessCriteriaTable.sortOrder), asc(projectSuccessCriteriaTable.createdAt));

  res.json(ListCriteriaResponse.parse(rows.map(formatCriterion)));
});

// POST /projects/:projectId/criteria
router.post("/projects/:projectId/criteria", async (req, res): Promise<void> => {
  const params = CreateCriterionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateCriterionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (!(await projectExists(params.data.projectId, req.user!.id))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Place new item at the end
  const existing = await db.select({ sortOrder: projectSuccessCriteriaTable.sortOrder })
    .from(projectSuccessCriteriaTable)
    .where(eq(projectSuccessCriteriaTable.projectId, params.data.projectId))
    .orderBy(asc(projectSuccessCriteriaTable.sortOrder));
  const maxOrder = existing.length > 0 ? (existing[existing.length - 1]?.sortOrder ?? 0) + 1 : 0;

  const [row] = await db.insert(projectSuccessCriteriaTable).values({
    id: uuidv4(),
    projectId: params.data.projectId,
    label: body.data.label,
    done: false,
    sortOrder: body.data.sortOrder ?? maxOrder,
  }).returning();

  res.status(201).json(CreateCriterionResponse.parse(formatCriterion(row)));
});

// PATCH /projects/:projectId/criteria/:criterionId
router.patch("/projects/:projectId/criteria/:criterionId", async (req, res): Promise<void> => {
  const params = UpdateCriterionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateCriterionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [row] = await db.update(projectSuccessCriteriaTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(
      eq(projectSuccessCriteriaTable.id, params.data.criterionId),
      eq(projectSuccessCriteriaTable.projectId, params.data.projectId),
    ))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Criterion not found" });
    return;
  }

  res.json(UpdateCriterionResponse.parse(formatCriterion(row)));
});

// DELETE /projects/:projectId/criteria/:criterionId
router.delete("/projects/:projectId/criteria/:criterionId", async (req, res): Promise<void> => {
  const params = DeleteCriterionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.delete(projectSuccessCriteriaTable)
    .where(and(
      eq(projectSuccessCriteriaTable.id, params.data.criterionId),
      eq(projectSuccessCriteriaTable.projectId, params.data.projectId),
    ))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Criterion not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
