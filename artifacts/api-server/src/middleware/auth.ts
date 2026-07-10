import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { verifyAccessToken } from "../lib/auth";

// Extend Express types with the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Omit<User, "passwordHash">;
    }
  }
}

/**
 * Extracts the bearer/cookie JWT, verifies it, loads the user, and attaches
 * to req.user. Returns 401 if any step fails.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    // Never expose the hash — strip it from the object on req.user
    // (using object rest here rather than delete for immutability + type inference)
    const { passwordHash: _passwordHash, ...safe } = user;
    req.user = safe;
    next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
      return;
    }
    res.status(401).json({ error: "Invalid token" });
  }
}

function extractToken(req: Request): string | null {
  // Cookie first (browser flow); then Authorization Bearer header (curl/CLI flow).
  const cookieToken = req.cookies?.access_token;
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}
