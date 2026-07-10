import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, apiKeysTable } from "@workspace/db";
import {
  CreateApiKeyBody,
  CreateApiKeyResponse,
  UpdateApiKeyParams,
  UpdateApiKeyBody,
  UpdateApiKeyResponse,
  DeleteApiKeyParams,
  ListApiKeysResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••••••" + key.slice(-4);
}

function formatKey(k: typeof apiKeysTable.$inferSelect) {
  return {
    id: k.id,
    provider: k.provider,
    label: k.label,
    maskedKey: maskKey(k.keyValue),
    isActive: k.isActive,
    baseUrl: k.baseUrl,
    createdAt: k.createdAt.toISOString(),
  };
}

router.get("/api-keys", async (req, res): Promise<void> => {
  const keys = await db.select().from(apiKeysTable)
    .where(eq(apiKeysTable.userId, req.user!.id))
    .orderBy(apiKeysTable.createdAt);
  res.json(ListApiKeysResponse.parse(keys.map(formatKey)));
});

router.post("/api-keys", async (req, res): Promise<void> => {
  const parsed = CreateApiKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [key] = await db.insert(apiKeysTable).values({
    id: uuidv4(),
    userId: req.user!.id,
    provider: parsed.data.provider,
    label: parsed.data.label,
    keyValue: parsed.data.keyValue,
    baseUrl: parsed.data.baseUrl ?? null,
    isActive: true,
  }).returning();

  res.status(201).json(CreateApiKeyResponse.parse(formatKey(key)));
});

router.patch("/api-keys/:keyId", async (req, res): Promise<void> => {
  const params = UpdateApiKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateApiKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof apiKeysTable.$inferInsert> = {};
  if (parsed.data.label != null) updateData.label = parsed.data.label;
  if (parsed.data.keyValue != null) updateData.keyValue = parsed.data.keyValue;
  if (parsed.data.isActive != null) updateData.isActive = parsed.data.isActive;
  if (parsed.data.baseUrl != null) updateData.baseUrl = parsed.data.baseUrl;

  const [key] = await db.update(apiKeysTable)
    .set(updateData)
    .where(and(
      eq(apiKeysTable.id, params.data.keyId),
      eq(apiKeysTable.userId, req.user!.id),
    ))
    .returning();

  if (!key) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  res.json(UpdateApiKeyResponse.parse(formatKey(key)));
});

router.delete("/api-keys/:keyId", async (req, res): Promise<void> => {
  const params = DeleteApiKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [key] = await db.delete(apiKeysTable)
    .where(and(
      eq(apiKeysTable.id, params.data.keyId),
      eq(apiKeysTable.userId, req.user!.id),
    ))
    .returning();
  if (!key) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
