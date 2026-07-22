import { Router, type IRouter } from "express";
import { eq, and, or, isNull, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, patternsTable, patternUsageLogTable, projectsTable } from "@workspace/db";
import { projectAccessWhere } from "../lib/project-access";

const router: IRouter = Router();

// GET /patterns — list all enabled patterns (built-in + user's team patterns)
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

    res.json(patterns.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })));
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

  const { patternId } = req.params;

  try {
    const [pattern] = await db.select()
      .from(patternsTable)
      .where(and(
        eq(patternsTable.id, patternId),
        or(isNull(patternsTable.userId), eq(patternsTable.userId, userId)),
      ));

    if (!pattern) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }

    res.json({
      ...pattern,
      createdAt: pattern.createdAt.toISOString(),
      updatedAt: pattern.updatedAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch pattern" });
  }
});

// POST /patterns/suggest — suggest patterns based on problem classification
// Body: { problemType: PatternProblemType, keywords?: string[] }
router.post("/patterns/suggest", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { problemType, keywords } = req.body ?? {};

  if (!problemType) {
    res.status(400).json({ error: "problemType is required" });
    return;
  }

  try {
    // Find patterns that match the problem type
    const allPatterns = await db.select()
      .from(patternsTable)
      .where(and(
        eq(patternsTable.isEnabled, true),
        eq(patternsTable.problemType, problemType),
        or(isNull(patternsTable.userId), eq(patternsTable.userId, userId)),
      ))
      .orderBy(asc(patternsTable.createdAt));

    // Filter by keywords if provided
    let suggested = allPatterns;
    if (Array.isArray(keywords) && keywords.length > 0) {
      const keywordSet = new Set(keywords.map((k: string) => k.toLowerCase()));
      suggested = allPatterns.filter(p => {
        const patternTriggers = (p.triggers as string[] || []).map((t: string) => t.toLowerCase());
        const matches = patternTriggers.filter(t => keywordSet.has(t)).length;
        return matches > 0;
      });
    }

    res.json({
      patterns: suggested.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to suggest patterns" });
  }
});

// POST /patterns/usage — log pattern usage
// Body: { patternId, projectId?, wasSuggested, wasAdopted, helpful?, feedback? }
router.post("/patterns/usage", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { patternId, projectId, wasSuggested, wasAdopted, helpful, feedback } = req.body ?? {};

  if (!patternId) {
    res.status(400).json({ error: "patternId is required" });
    return;
  }

  try {
    // Verify pattern exists
    const [pattern] = await db.select().from(patternsTable).where(eq(patternsTable.id, patternId));
    if (!pattern) {
      res.status(404).json({ error: "Pattern not found" });
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

    // Log usage
    const [log] = await db.insert(patternUsageLogTable).values({
      id: uuidv4(),
      userId,
      projectId: projectId || null,
      patternId,
      wasSuggested: !!wasSuggested,
      wasAdopted: !!wasAdopted,
      helpful: helpful ?? null,
      feedback: feedback ?? null,
    }).returning();

    res.status(201).json({
      ...log,
      createdAt: log.createdAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to log pattern usage" });
  }
});

export default router;
