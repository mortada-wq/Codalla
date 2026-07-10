import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { z } from "zod/v4";
import {
  db,
  usersTable,
  loginAttemptsTable,
  passwordResetTokensTable,
  settingsTable,
  type User,
} from "@workspace/db";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from "../lib/auth";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// ─── Public: register ─────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(80),
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const id = uuidv4();
  const [user] = await db.insert(usersTable).values({
    id,
    email,
    passwordHash,
    name,
    role: "owner",
  }).returning();

  await ensureUserSettings(id);

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json(publicUser(user));
});

// ─── Public: login ────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const { email, password } = parsed.data;

  const ip = extractIp(req);
  const identifier = `${ip}:${email}`;

  // Brute-force check
  const [attempts] = await db.select().from(loginAttemptsTable).where(eq(loginAttemptsTable.identifier, identifier));
  if (attempts?.lockedUntil && attempts.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(429).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash) {
    await recordFailedAttempt(identifier);
    // Same message for "no user" and "wrong password" to avoid enumeration
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordFailedAttempt(identifier);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Success — clear attempts, issue tokens
  await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.identifier, identifier));
  await ensureUserSettings(user.id);

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.json(publicUser(user));
});

// ─── Public: Google session exchange (Emergent-managed auth) ──────────────
// Frontend receives ?session_id=<x> from Emergent's OAuth callback,
// and POSTs it here. We exchange it for user info, upsert the user,
// and issue our own JWT cookies. The session_id is used ONCE.
const googleSessionSchema = z.object({
  sessionId: z.string().min(10),
});

router.post("/auth/google/session", async (req: Request, res: Response) => {
  const parsed = googleSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }
  const { sessionId } = parsed.data;

  // Call Emergent's session-data endpoint to exchange the temporary session_id
  // for the user's Google profile. This MUST happen server-side; the session_id
  // grants one-time access and shouldn't be exposed to any other party.
  let profile: { id: string; email: string; name: string; picture?: string };
  try {
    const upstream = await fetch(
      "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
      { headers: { "X-Session-ID": sessionId } }
    );
    if (!upstream.ok) {
      const detail = await upstream.text();
      logger.warn({ status: upstream.status, detail }, "Emergent session-data upstream error");
      res.status(401).json({ error: "Google session could not be verified" });
      return;
    }
    profile = await upstream.json();
  } catch (err: any) {
    logger.error({ err }, "Failed to reach Emergent auth service");
    res.status(502).json({ error: "Google sign-in provider is unreachable" });
    return;
  }

  const email = profile.email.trim().toLowerCase();

  // Upsert: if we already know this googleId or email, reuse; else create.
  let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.id));
  if (!user) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (user) {
      // Same email as an existing password-only account — link it.
      [user] = await db.update(usersTable)
        .set({ googleId: profile.id, avatarUrl: profile.picture ?? user.avatarUrl, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id))
        .returning();
    } else {
      // Brand new user
      const id = uuidv4();
      [user] = await db.insert(usersTable).values({
        id,
        email,
        googleId: profile.id,
        name: profile.name,
        avatarUrl: profile.picture ?? null,
        emailVerified: true,
        role: "owner",
      }).returning();
    }
  }

  await ensureUserSettings(user.id);

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.json(publicUser(user));
});

// ─── Public: refresh access token ─────────────────────────────────────────
router.post("/auth/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }
  try {
    const payload = verifyRefreshToken(token);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const accessToken = signAccessToken(user.id, user.email);
    const refreshToken = signRefreshToken(user.id);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// ─── Authed: me ───────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  res.json(req.user);
});

// ─── Authed: logout ───────────────────────────────────────────────────────
router.post("/auth/logout", requireAuth, async (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

// ─── Authed: update profile ───────────────────────────────────────────────
const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  githubHandle: z.string().max(80).optional().nullable(),
  timezone: z.string().max(60).optional(),
  orgName: z.string().max(120).optional().nullable(),
});

router.patch("/auth/profile", requireAuth, async (req: Request, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const patch: Partial<User> = { updatedAt: new Date() };
  const { name, bio, avatarUrl, githubHandle, timezone, orgName } = parsed.data;
  if (name !== undefined) patch.name = name;
  if (bio !== undefined) patch.bio = bio ?? null;
  if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl === "" ? null : avatarUrl;
  if (githubHandle !== undefined) patch.githubHandle = githubHandle ?? null;
  if (timezone !== undefined) patch.timezone = timezone;
  if (orgName !== undefined) patch.orgName = orgName ?? null;

  const [updated] = await db.update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, req.user!.id))
    .returning();
  res.json(publicUser(updated));
});

// ─── Authed: change password ──────────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),   // optional for Google-only accounts setting a password for the first time
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  const [full] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!full) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (full.passwordHash) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password required" });
      return;
    }
    const ok = await verifyPassword(currentPassword, full.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
  }
  const newHash = await hashPassword(newPassword);
  await db.update(usersTable)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(usersTable.id, full.id));

  res.json({ ok: true });
});

// ─── Public: forgot password ──────────────────────────────────────────────
const forgotSchema = z.object({ email: z.string().email().transform(v => v.trim().toLowerCase()) });

router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  // Always respond OK — never leak whether the email exists.
  if (!parsed.success) { res.json({ ok: true }); return; }
  const { email } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.insert(passwordResetTokensTable).values({
      token,
      userId: user.id,
      expiresAt,
    });
    // In development, we log the reset link. In production this would go to email.
    const resetLink = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;
    logger.info({ resetLink, email }, "Password reset link generated");
  }
  res.json({ ok: true });
});

// ─── Public: reset password ───────────────────────────────────────────────
const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { token, password } = parsed.data;

  const [reset] = await db.select().from(passwordResetTokensTable).where(eq(passwordResetTokensTable.token, token));
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    res.status(400).json({ error: "This link has expired or already been used." });
    return;
  }
  const newHash = await hashPassword(password);
  await db.update(usersTable)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(usersTable.id, reset.userId));
  await db.update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.token, token));

  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════
function publicUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function extractIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function recordFailedAttempt(identifier: string) {
  const [existing] = await db.select().from(loginAttemptsTable).where(eq(loginAttemptsTable.identifier, identifier));
  if (!existing) {
    await db.insert(loginAttemptsTable).values({ identifier, attempts: 1 });
    return;
  }
  const nextAttempts = existing.attempts + 1;
  const lockedUntil = nextAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
  await db.update(loginAttemptsTable)
    .set({ attempts: nextAttempts, lockedUntil, updatedAt: new Date() })
    .where(eq(loginAttemptsTable.identifier, identifier));
}

async function ensureUserSettings(userId: string) {
  // Idempotent — INSERT ... ON CONFLICT DO NOTHING keeps this safe on any call.
  await db.insert(settingsTable)
    .values({ userId })
    .onConflictDoNothing({ target: settingsTable.userId })
    .catch(() => {/* the settings row may already exist */});
  // Fallback in case onConflict isn't wired: silently ignore duplicate errors
  void sql;
}

export default router;
