import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

// Codalla runs as a single-user personal tool: there is no login. Every
// request is attributed to one implicit local user so the per-user data
// model (userId FKs on all tables) keeps working unchanged.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const LOCAL_USER_ID = "local";
const LOCAL_USER_EMAIL = "local@codalla.local";

let cachedUser: User | null = null;

/**
 * Ensures the single local user row exists (created lazily on first request)
 * and attaches it to req.user for downstream routes.
 */
export async function localUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
