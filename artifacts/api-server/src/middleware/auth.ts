import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, usersTable, sessionsTable, type User } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const SESSION_COOKIE = "codalla_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// AUTH_DISABLED=true skips Google sign-in entirely and attributes every
// request to one implicit local user — handy for solo development.
export const AUTH_DISABLED = process.env["AUTH_DISABLED"] === "true";

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Resolves the session cookie to a user and attaches it to req.user.
 * Returns 401 when there is no valid, unexpired session.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (AUTH_DISABLED) {
    return localUser(req, res, next);
  }

  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  try {
    const [row] = await db
      .select({ user: usersTable })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(and(eq(sessionsTable.tokenHash, hashSessionToken(token)), gt(sessionsTable.expiresAt, new Date())));

    if (!row) {
      res.clearCookie(SESSION_COOKIE);
      res.status(401).json({ error: "Session expired" });
      return;
    }
    req.user = row.user;
    next();
  } catch (err) {
    next(err);
  }
}

// ─── AUTH_DISABLED fallback: single implicit local user ─────────────────────

const LOCAL_USER_ID = "local";
const LOCAL_USER_EMAIL = "local@codalla.local";

let cachedUser: User | null = null;

async function localUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!cachedUser) {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, LOCAL_USER_ID));
      cachedUser =
        existing ??
        (
          await db
            .insert(usersTable)
            .values({ id: LOCAL_USER_ID, email: LOCAL_USER_EMAIL, name: "Local User" })
            .onConflictDoNothing()
            .returning()
        )[0] ??
        (await db.select().from(usersTable).where(eq(usersTable.id, LOCAL_USER_ID)))[0];
    }
    req.user = cachedUser;
    next();
  } catch (err) {
    next(err);
  }
}
