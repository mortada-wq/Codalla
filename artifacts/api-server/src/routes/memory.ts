import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, projectsTable, projectMemoryNotesTable } from "@workspace/db";
import {
  ListMemoryNotesParams,
  ListMemoryNotesResponse,
  CreateMemoryNoteParams,
  CreateMemoryNoteBody,
  CreateMemoryNoteResponse,
  GetMemoryNoteParams,
  GetMemoryNoteResponse,
  UpdateMemoryNoteParams,
  UpdateMemoryNoteBody,
  UpdateMemoryNoteResponse,
  DeleteMemoryNoteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function projectExists(projectId: string, userId: string): Promise<boolean> {
  const [p] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return !!p;
}

function formatNote(n: typeof projectMemoryNotesTable.$inferSelect) {
  return {
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// GET /projects/:projectId/memory
router.get("/projects/:projectId/memory", async (req, res): Promise<void> => {
  const params = ListMemoryNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await projectExists(params.data.projectId, req.user!.id))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const rows = await db.select()
    .from(projectMemoryNotesTable)
    .where(eq(projectMemoryNotesTable.projectId, params.data.projectId))
    .orderBy(asc(projectMemoryNotesTable.createdAt));

  res.json(ListMemoryNotesResponse.parse(rows.map(formatNote)));
});

// POST /projects/:projectId/memory
router.post("/projects/:projectId/memory", async (req, res): Promise<void> => {
  const params = CreateMemoryNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateMemoryNoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (!(await projectExists(params.data.projectId, req.user!.id))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [row] = await db.insert(projectMemoryNotesTable).values({
    id: uuidv4(),
    projectId: params.data.projectId,
    title: body.data.title,
    content: body.data.content ?? "",
  }).returning();

  res.status(201).json(CreateMemoryNoteResponse.parse(formatNote(row)));
});

// GET /projects/:projectId/memory/:noteId
router.get("/projects/:projectId/memory/:noteId", async (req, res): Promise<void> => {
  const params = GetMemoryNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.select()
    .from(projectMemoryNotesTable)
    .where(eq(projectMemoryNotesTable.id, params.data.noteId));

  if (!row || row.projectId !== params.data.projectId) {
    res.status(404).json({ error: "Memory note not found" });
    return;
  }

  res.json(GetMemoryNoteResponse.parse(formatNote(row)));
});

// PATCH /projects/:projectId/memory/:noteId
router.patch("/projects/:projectId/memory/:noteId", async (req, res): Promise<void> => {
  const params = UpdateMemoryNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateMemoryNoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [row] = await db.update(projectMemoryNotesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(
      eq(projectMemoryNotesTable.id, params.data.noteId),
      eq(projectMemoryNotesTable.projectId, params.data.projectId),
    ))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Memory note not found" });
    return;
  }

  res.json(UpdateMemoryNoteResponse.parse(formatNote(row)));
});

// DELETE /projects/:projectId/memory/:noteId
router.delete("/projects/:projectId/memory/:noteId", async (req, res): Promise<void> => {
  const params = DeleteMemoryNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.delete(projectMemoryNotesTable)
    .where(and(
      eq(projectMemoryNotesTable.id, params.data.noteId),
      eq(projectMemoryNotesTable.projectId, params.data.projectId),
    ))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Memory note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
