import { Router, type IRouter } from "express";

const router: IRouter = Router();

// All phone auth endpoints are no-ops in no-auth mode.
// Keep stubs to prevent 404s if the frontend still calls them.

router.post("/phone-auth/request-otp", (req, res) => {
  res.json({ success: true, message: "Phone verification disabled" });
});

router.post("/phone-auth/verify-otp", (req, res) => {
  res.json({ success: true, message: "Phone verification disabled" });
});

router.get("/phone-auth/status", (req, res) => {
  res.json({ phoneVerified: true, phoneNumber: null });
});

export default router;

