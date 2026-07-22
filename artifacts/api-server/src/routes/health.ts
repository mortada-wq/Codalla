import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
  } catch {
    res.status(503).json(HealthCheckResponse.parse({ status: "error" }));
    return;
  }
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

export default router;
