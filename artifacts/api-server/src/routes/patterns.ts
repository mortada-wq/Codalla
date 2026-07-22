import { Router, type IRouter } from "express";
import { eq, and, or, isNull, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, patternsTable, patternUsageLogTable, projectsTable } from "@workspace/db";
import { projectAccessWhere } from "../lib/project-access";
import {
  ListPatternsResponse,
  GetPatternParams,
  GetPatternResponse,
  SuggestPatternsBody,
  SuggestPatternsResponse,
  LogPatternUsageBody,
  LogPatternUsageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPattern(p: typeof patternsTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// GET /patterns — list all enabled patterns (built-in + this account's own)
router.get("/patterns", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const patterns = await db.select()
      .from(patternsTable)
      .where(and(
        eq(patternsTable.isEnabled, true),
        // Built-in patterns (userId is null) or this account's own custom patterns
        or(isNull(patternsTable.userId), eq(patternsTable.userId, userId)),
      ));

    res.json(ListPatternsResponse.parse(patterns.map(formatPattern)));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch patterns" });
  }
});

// GET /patterns/:patternId — get a specific pattern
router.get("/patterns/:patternId", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetPatternParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const [pattern] = await db.select()
      .from(patternsTable)
      .where(and(
        eq(patternsTable.id, params.data.patternId),
        or(isNull(patternsTable.userId), eq(patternsTable.userId, userId)),
      ));

    if (!pattern) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }

    res.json(GetPatternResponse.parse(formatPattern(pattern)));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch pattern" });
  }
});

// POST /patterns/suggest — suggest patterns based on problem classification
router.post("/patterns/suggest", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = SuggestPatternsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    // Find patterns that match the problem type
    const allPatterns = await db.select()
      .from(patternsTable)
      .where(and(
        eq(patternsTable.isEnabled, true),
        eq(patternsTable.problemType, body.data.problemType),
        or(isNull(patternsTable.userId), eq(patternsTable.userId, userId)),
      ))
      .orderBy(asc(patternsTable.createdAt));

    // Filter by keywords if provided
    let suggested = allPatterns;
    if (body.data.keywords && body.data.keywords.length > 0) {
      const keywordSet = new Set(body.data.keywords.map((k) => k.toLowerCase()));
      suggested = allPatterns.filter(p => {
        const patternTriggers = (p.triggers as string[] || []).map((t: string) => t.toLowerCase());
        const matches = patternTriggers.filter(t => keywordSet.has(t)).length;
        return matches > 0;
      });
    }

    res.json(SuggestPatternsResponse.parse({ patterns: suggested.map(formatPattern) }));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to suggest patterns" });
  }
});

// POST /patterns/usage — log pattern usage
router.post("/patterns/usage", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = LogPatternUsageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    // Verify pattern exists and is visible to this account
    const [pattern] = await db.select().from(patternsTable)
      .where(and(
        eq(patternsTable.id, body.data.patternId),
        or(isNull(patternsTable.userId), eq(patternsTable.userId, userId)),
      ));
    if (!pattern) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }

    // Verify project access if provided
    if (body.data.projectId) {
      const [project] = await db.select().from(projectsTable)
        .where(projectAccessWhere(body.data.projectId, userId));
      if (!project) {
        res.status(403).json({ error: "Project not accessible" });
        return;
      }
    }

    const [log] = await db.insert(patternUsageLogTable).values({
      id: uuidv4(),
      userId,
      projectId: body.data.projectId ?? null,
      patternId: body.data.patternId,
      wasSuggested: !!body.data.wasSuggested,
      wasAdopted: !!body.data.wasAdopted,
      helpful: body.data.helpful ?? null,
      feedback: body.data.feedback ?? null,
    }).returning();

    res.status(201).json(LogPatternUsageResponse.parse({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to log pattern usage" });
  }
});

export default router;
