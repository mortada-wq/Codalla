import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /auth/me — return the implicit local user
router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  const { id, email, name, avatarUrl } = req.user!;
  res.json({ id, email, name, avatarUrl });
});

// POST /auth/logout — no-op (app is open, no sessions)
router.post("/auth/logout", (req: Request, res: Response) => {
  res.status(204).end();
});

export default router;

