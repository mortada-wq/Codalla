import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreateSettings(userId: string) {
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(settingsTable).values({ userId }).returning();
  return created;
}

function formatSettings(s: typeof settingsTable.$inferSelect) {
  return {
    defaultModelId: s.defaultModelId,
    defaultProvider: s.defaultProvider,
    theme: s.theme as "dark" | "light" | "high-contrast",
    fontSize: s.fontSize,
    tabSize: s.tabSize,
    wordWrap: s.wordWrap,
    minimap: s.minimap,
    sendContextWithMessages: s.sendContextWithMessages,
    githubToken: s.githubToken ? "••••••••" + s.githubToken.slice(-4) : null,
    runpodEndpoint: s.runpodEndpoint ?? null,
  };
}

router.get("/settings", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings(req.user!.id);
  res.json(GetSettingsResponse.parse(formatSettings(settings)));
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await getOrCreateSettings(req.user!.id);

  const [updated] = await db.update(settingsTable)
    .set(parsed.data)
    .where(eq(settingsTable.userId, req.user!.id))
    .returning();

  res.json(UpdateSettingsResponse.parse(formatSettings(updated)));
});

export default router;
