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

// Local user for open access mode
const LOCAL_USER_ID = "local";
const LOCAL_USER_EMAIL = "local@codalla.local";

let cachedUser: User | null = null;

/**
 * Attach an implicit local user to every request.
 * No auth required; everyone has access to all routes.
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

