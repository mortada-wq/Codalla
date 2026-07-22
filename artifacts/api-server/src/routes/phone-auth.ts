import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Phone auth disabled — all endpoints are no-ops
router.post("/phone-auth/request-otp", (req, res) => {
  res.json({ success: true });
});

router.post("/phone-auth/verify-otp", (req, res) => {
  res.json({ success: true });
});

router.get("/phone-auth/status", (req, res) => {
  res.json({ phoneVerified: true });
});

export default router;

