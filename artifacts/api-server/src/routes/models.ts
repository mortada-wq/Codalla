import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, customModelsTable } from "@workspace/db";

const router: IRouter = Router();

const VALID_PROVIDERS = ["siliconflow", "openrouter", "runpod", "custom"] as const;

function validateInput(body: any): { error: string } | null {
  if (!body.name || typeof body.name !== "string") return { error: "name is required" };
  if (!body.modelId || typeof body.modelId !== "string") return { error: "modelId is required" };
  if (!body.provider || !VALID_PROVIDERS.includes(body.provider)) return { error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` };
  return null;
}

function formatModel(m: typeof customModelsTable.$inferSelect) {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

router.get("/models/custom", async (req, res): Promise<void> => {
  const rows = await db.select().from(customModelsTable)
    .where(eq(customModelsTable.userId, req.user!.id))
    .orderBy(customModelsTable.createdAt);
  res.json(rows.map(formatModel));
});

router.post("/models/custom", async (req, res): Promise<void> => {
  const err = validateInput(req.body);
  if (err) { res.status(400).json(err); return; }

  const { name, modelId, provider, description, contextLength, pricingPrompt, pricingCompletion, isEnabled } = req.body;

  const [row] = await db.insert(customModelsTable).values({
    id: uuidv4(),
    userId: req.user!.id,
    name: String(name),
    modelId: String(modelId),
    provider: String(provider),
    description: description ? String(description) : null,
    contextLength: contextLength != null ? Number(contextLength) : 8192,
    pricingPrompt: pricingPrompt != null ? Number(pricingPrompt) : 0,
    pricingCompletion: pricingCompletion != null ? Number(pricingCompletion) : 0,
    isEnabled: isEnabled !== false,
  }).returning();

  res.status(201).json(formatModel(row));
});

router.put("/models/custom/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, modelId, provider, description, contextLength, pricingPrompt, pricingCompletion, isEnabled } = req.body;

  if (provider && !VALID_PROVIDERS.includes(provider)) {
    res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` });
    return;
  }

  const update: Partial<typeof customModelsTable.$inferInsert> = {};
  if (name !== undefined) update.name = String(name);
  if (modelId !== undefined) update.modelId = String(modelId);
  if (provider !== undefined) update.provider = String(provider);
  if (description !== undefined) update.description = description ? String(description) : null;
  if (contextLength !== undefined) update.contextLength = Number(contextLength);
  if (pricingPrompt !== undefined) update.pricingPrompt = Number(pricingPrompt);
  if (pricingCompletion !== undefined) update.pricingCompletion = Number(pricingCompletion);
  if (isEnabled !== undefined) update.isEnabled = Boolean(isEnabled);

  const [row] = await db.update(customModelsTable).set(update)
    .where(and(
      eq(customModelsTable.id, id),
      eq(customModelsTable.userId, req.user!.id),
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "Model not found" }); return; }
  res.json(formatModel(row));
});

router.delete("/models/custom/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [row] = await db.delete(customModelsTable)
    .where(and(
      eq(customModelsTable.id, id),
      eq(customModelsTable.userId, req.user!.id),
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "Model not found" }); return; }
  res.sendStatus(204);
});

export default router;
