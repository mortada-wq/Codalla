import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, usageLogTable } from "@workspace/db";
import {
  ListUsageQueryParams,
  ListUsageResponse,
  GetUsageSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/usage", async (req, res): Promise<void> => {
  const parsed = ListUsageQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0, model } = parsed.data;
  const userId = req.user!.id;

  const whereClause = model
    ? and(eq(usageLogTable.userId, userId), eq(usageLogTable.model, model))
    : eq(usageLogTable.userId, userId);

  const entries = await db.select().from(usageLogTable)
    .where(whereClause)
    .orderBy(desc(usageLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ count: sql<number>`count(*)::int` })
    .from(usageLogTable)
    .where(whereClause);
  const total = totalResult[0]?.count ?? 0;

  res.json(ListUsageResponse.parse({
    entries: entries.map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    offset,
    limit,
  }));
});

router.get("/usage/summary", async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const [totals] = await db.select({
    totalCost: sql<number>`COALESCE(SUM(cost), 0)::float`,
    totalTokens: sql<number>`COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int`,
    totalRequests: sql<number>`COUNT(*)::int`,
  }).from(usageLogTable).where(eq(usageLogTable.userId, userId));

  const [today] = await db.select({
    todayCost: sql<number>`COALESCE(SUM(cost), 0)::float`,
    todayTokens: sql<number>`COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int`,
  }).from(usageLogTable)
    .where(and(eq(usageLogTable.userId, userId), sql`DATE(created_at) = CURRENT_DATE`));

  const byModel = await db.select({
    model: usageLogTable.model,
    provider: usageLogTable.provider,
    totalTokens: sql<number>`COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int`,
    totalCost: sql<number>`COALESCE(SUM(cost), 0)::float`,
    requestCount: sql<number>`COUNT(*)::int`,
  }).from(usageLogTable)
    .where(eq(usageLogTable.userId, userId))
    .groupBy(usageLogTable.model, usageLogTable.provider);

  res.json(GetUsageSummaryResponse.parse({
    totalCost: totals?.totalCost ?? 0,
    totalTokens: totals?.totalTokens ?? 0,
    totalRequests: totals?.totalRequests ?? 0,
    todayCost: today?.todayCost ?? 0,
    todayTokens: today?.todayTokens ?? 0,
    byModel: byModel ?? [],
  }));
});

export default router;
