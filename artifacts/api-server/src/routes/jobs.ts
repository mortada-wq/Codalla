import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { projectAccessWhere } from "../lib/project-access";
import { JobQueue, enqueueBatchGeneration, JobDefinition } from "../lib/job-queue";

const router: IRouter = Router();

// GET /jobs/:projectId/status
// List all jobs for a project with their status and progress
router.get("/jobs/:projectId/status", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Verify project access
    const [project] = await db.select().from(projectsTable)
      .where(projectAccessWhere(projectId, userId));

    if (!project) {
      res.status(403).json({ error: "Project not accessible" });
      return;
    }

    // Get all jobs for this project
    const jobs = JobQueue.listByProject(projectId);

    res.json({
      projectId,
      jobs: jobs.map(j => ({
        id: j.id,
        type: j.type,
        status: j.status,
        progress: j.progress,
        createdAt: j.createdAt.toISOString(),
        startedAt: j.startedAt?.toISOString(),
        completedAt: j.completedAt?.toISOString(),
        error: j.error,
        result: j.result,
      })),
      total: jobs.length,
      active: jobs.filter(j => j.status === "running").length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch job status" });
  }
});

// GET /jobs/:jobId
// Get detailed status of a specific job
router.get("/jobs/:jobId", async (req, res): Promise<void> => {
  const { jobId } = req.params;

  try {
    const job = JobQueue.get(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      error: job.error,
      result: job.result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch job" });
  }
});

// POST /jobs/:projectId/batch-generate
// Start a batch file generation job
// Body: { prompt: string, modelId: string, provider: string }
router.post("/jobs/:projectId/batch-generate", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.id;
  const { prompt, modelId, provider } = req.body ?? {};

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!prompt || !modelId || !provider) {
    res.status(400).json({ error: "prompt, modelId, and provider are required" });
    return;
  }

  try {
    // Verify project access
    const [project] = await db.select().from(projectsTable)
      .where(projectAccessWhere(projectId, userId));

    if (!project) {
      res.status(403).json({ error: "Project not accessible" });
      return;
    }

    // Enqueue the job
    const jobId = await enqueueBatchGeneration(userId, projectId, prompt, modelId, provider);

    res.status(201).json({
      jobId,
      status: "pending",
      message: "Batch generation job enqueued. Use GET /jobs/:jobId to check progress.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to enqueue job" });
  }
});

// POST /jobs/:jobId/cancel
// Cancel a running job
router.post("/jobs/:jobId/cancel", async (req, res): Promise<void> => {
  const { jobId } = req.params;

  try {
    const job = JobQueue.get(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    if (job.status === "completed" || job.status === "failed") {
      res.status(400).json({ error: `Cannot cancel ${job.status} job` });
      return;
    }

    JobQueue.update(jobId, { status: "failed", error: "Cancelled by user" });

    res.json({ message: "Job cancelled" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to cancel job" });
  }
});

export default router;
