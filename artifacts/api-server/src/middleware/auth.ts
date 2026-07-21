import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

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

// Local user for no-auth mode (always enabled)
const LOCAL_USER_ID = "local";
const LOCAL_USER_EMAIL = "local@codalla.local";

let cachedUser: User | null = null;

/**
 * Attach an implicit local user to every request.
 * No session validation; everyone is logged in as the same local user.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
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

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

