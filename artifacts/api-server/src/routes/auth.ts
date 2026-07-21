import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /auth/me — current user (always returns the implicit local user)
router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  const { id, email, name, avatarUrl } = req.user!;
  res.json({ id, email, name, avatarUrl });
});

// POST /auth/logout — no-op in no-auth mode
router.post("/auth/logout", async (req: Request, res: Response) => {
  res.status(204).end();
});

export default router;

