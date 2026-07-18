import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { requireAuth, hashSessionToken, SESSION_COOKIE, SESSION_TTL_MS, AUTH_DISABLED } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Config ───────────────────────────────────────────────────────────────────
// APP_URL is the origin users open in the browser; the Google OAuth client
// must list `${APP_URL}/api/auth/google/callback` as an authorized redirect URI.
const APP_URL = (process.env["APP_URL"] ?? "http://localhost:5173").replace(/\/$/, "");
const CLIENT_ID = process.env["GOOGLE_CLIENT_ID"];
const CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"];
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;
const IS_PROD = process.env["NODE_ENV"] === "production";
const STATE_COOKIE = "codalla_oauth_state";

// Team gating: comma-separated lists. If both are empty, any Google account
// may sign in (fine behind a firewall; set a domain before exposing publicly).
const ALLOWED_DOMAINS = (process.env["ALLOWED_EMAIL_DOMAINS"] ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const ALLOWED_EMAILS = (process.env["ALLOWED_EMAILS"] ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

if (!AUTH_DISABLED && (!CLIENT_ID || !CLIENT_SECRET)) {
  logger.warn("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — sign-in will fail until they are configured (or set AUTH_DISABLED=true for local dev)");
}
if (!AUTH_DISABLED && ALLOWED_DOMAINS.length === 0 && ALLOWED_EMAILS.length === 0) {
  logger.warn("ALLOWED_EMAIL_DOMAINS / ALLOWED_EMAILS are not set — ANY Google account can sign in");
}

function oauthClient(): OAuth2Client | null {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function isEmailAllowed(email: string): boolean {
  if (ALLOWED_DOMAINS.length === 0 && ALLOWED_EMAILS.length === 0) return true;
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1] ?? "";
  return ALLOWED_DOMAINS.includes(domain);
}

// ─── Sign-in flow ─────────────────────────────────────────────────────────────

// GET /auth/google — kick off the OAuth flow
router.get("/auth/google", (req: Request, res: Response) => {
  const client = oauthClient();
  if (!client) {
    res.status(503).json({ error: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: IS_PROD, maxAge: 10 * 60 * 1000 });
  res.redirect(client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  }));
});

// GET /auth/google/callback — exchange the code, gate by team, start a session
router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const client = oauthClient();
  const code = req.query["code"];
  const state = req.query["state"];
  const expectedState = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  if (!client || typeof code !== "string" || typeof state !== "string" || !expectedState || state !== expectedState) {
    res.redirect(`${APP_URL}/login?error=oauth_failed`);
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error("No id_token in Google response");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error("Google profile missing sub/email");

    const email = payload.email.toLowerCase();
    if (!isEmailAllowed(email)) {
      logger.warn({ email }, "Sign-in rejected: email not in team allowlist");
      res.redirect(`${APP_URL}/login?error=not_allowed`);
      return;
    }

    // Upsert: match by googleId first, then link by email, else create.
    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, payload.sub));
    if (!user) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (user) {
        [user] = await db.update(usersTable)
          .set({ googleId: payload.sub, avatarUrl: payload.picture ?? user.avatarUrl, updatedAt: new Date() })
          .where(eq(usersTable.id, user.id))
          .returning();
      } else {
        [user] = await db.insert(usersTable).values({
          id: uuidv4(),
          email,
          googleId: payload.sub,
          name: payload.name ?? email,
          avatarUrl: payload.picture ?? null,
        }).returning();
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    await db.insert(sessionsTable).values({
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: SESSION_TTL_MS,
    });

    // Check if user has verified phone; if not, redirect to phone verification
    const { userPhonesTable } = await import("@workspace/db");
    const [userPhone] = await db.select().from(userPhonesTable)
      .where(eq(userPhonesTable.userId, user.id));

    const isPhoneVerified = userPhone?.verifiedAt ? true : false;
    const redirectUrl = isPhoneVerified ? APP_URL : `${APP_URL}/phone-verify`;
    res.redirect(redirectUrl);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    res.redirect(`${APP_URL}/login?error=oauth_failed`);
  }
});

// ─── Session endpoints ────────────────────────────────────────────────────────

// GET /auth/me — current user (401 when signed out)
router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  const { id, email, name, avatarUrl } = req.user!;
  res.json({ id, email, name, avatarUrl });
});

// POST /auth/logout — revoke this browser's session
router.post("/auth/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token.length > 0) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
  }
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

export default router;
