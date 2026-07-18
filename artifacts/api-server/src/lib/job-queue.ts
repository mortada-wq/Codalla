import { v4 as uuidv4 } from "uuid";

/**
 * Pragmatic async job queue using database backing (MVP approach).
 * For production scale-out, replace with Bull + Redis.
 */

export type JobType = "batch-generate-files" | "batch-analyze-media" | "batch-transform-files";
export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobDefinition {
  id: string;
  type: JobType;
  status: JobStatus;
  userId: string;
  projectId: string;
  payload: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  progress: number; // 0-100
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Job queue: in-memory registry for active jobs (MVP)
// In production, this would be backed by a persistent queue like Bull/Redis
const activeJobs = new Map<string, JobDefinition>();

export class JobQueue {
  static create(type: JobType, userId: string, projectId: string, payload: Record<string, any>): JobDefinition {
    const job: JobDefinition = {
      id: uuidv4(),
      type,
      status: "pending",
      userId,
      projectId,
      payload,
      progress: 0,
      createdAt: new Date(),
    };
    activeJobs.set(job.id, job);
    return job;
  }

  static get(jobId: string): JobDefinition | undefined {
    return activeJobs.get(jobId);
  }

  static update(jobId: string, updates: Partial<JobDefinition>): JobDefinition | undefined {
    const job = activeJobs.get(jobId);
    if (!job) return undefined;
    Object.assign(job, updates);
    activeJobs.set(jobId, job);
    return job;
  }

  static listByProject(projectId: string): JobDefinition[] {
    return Array.from(activeJobs.values()).filter(j => j.projectId === projectId);
  }

  static listByUser(userId: string): JobDefinition[] {
    return Array.from(activeJobs.values()).filter(j => j.userId === userId);
  }
}

// Example: Enqueue a batch file generation job
export async function enqueueBatchGeneration(userId: string, projectId: string, prompt: string, modelId: string, provider: string): Promise<string> {
  const job = JobQueue.create("batch-generate-files", userId, projectId, {
    prompt,
    modelId,
    provider,
  });
  // Queue would process job asynchronously
  // For MVP, return job ID for polling
  return job.id;
}

// Example: Process a batch job (would be called by worker/handler)
export function* processBatchJob(jobId: string): Generator<JobDefinition | null> {
  const job = JobQueue.get(jobId);
  if (!job) return null;

  // Start
  JobQueue.update(jobId, { status: "running", startedAt: new Date(), progress: 10 });
  yield JobQueue.get(jobId)!;

  try {
    // Simulated work: in production, this would call generate-files or similar
    JobQueue.update(jobId, { progress: 50 });
    yield JobQueue.get(jobId)!;

    // Complete
    JobQueue.update(jobId, {
      status: "completed",
      completedAt: new Date(),
      progress: 100,
      result: { filesGenerated: 5 },
    });
    yield JobQueue.get(jobId)!;
  } catch (err: any) {
    JobQueue.update(jobId, {
      status: "failed",
      completedAt: new Date(),
      error: err?.message ?? "Unknown error",
    });
    yield JobQueue.get(jobId)!;
  }
}
