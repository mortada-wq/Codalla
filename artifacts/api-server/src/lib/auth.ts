import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";

const JWT_ALGORITHM = "HS256" as const;
const ACCESS_TOKEN_EXPIRES_SEC = 15 * 60;         // 15 minutes
const REFRESH_TOKEN_EXPIRES_SEC = 7 * 24 * 60 * 60; // 7 days

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AccessTokenPayload {
  sub: string;         // user id
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

export function signAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = { sub: userId, email, type: "access" };
  return jwt.sign(payload, getJwtSecret(), { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_EXPIRES_SEC });
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh" };
  return jwt.sign(payload, getJwtSecret(), { algorithm: JWT_ALGORITHM, expiresIn: REFRESH_TOKEN_EXPIRES_SEC });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as AccessTokenPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as RefreshTokenPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  // Same-origin app — httpOnly cookies are the safest place for these tokens.
  const isProd = process.env["NODE_ENV"] === "production";
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookie("access_token", accessToken, { ...common, maxAge: ACCESS_TOKEN_EXPIRES_SEC * 1000 });
  res.cookie("refresh_token", refreshToken, { ...common, maxAge: REFRESH_TOKEN_EXPIRES_SEC * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}
