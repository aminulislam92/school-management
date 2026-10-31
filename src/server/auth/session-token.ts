// Signs and verifies the login cookie. No Next.js imports, so it is unit-testable.
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 7;

/**
 * What the cookie carries. Keep it minimal: no names, phones or emails.
 * uid = User.id, sch = School.id (null for the super admin), roles = Role[],
 * ver = User.sessionVersion when the cookie was made (a password change bumps
 * it, which makes every older cookie invalid)
 */
export type SessionPayload = {
  uid: number;
  sch: number | null;
  roles: Role[];
  ver: number;
};

export function secretKey(secret = process.env.AUTH_SECRET): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters. See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, key = secretKey()): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key);
}

/** Returns null for a missing, tampered, expired or malformed token. */
export async function verifySession(
  token: string | undefined,
  key = secretKey(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const { uid, sch, roles, ver } = payload as Record<string, unknown>;
    if (typeof uid !== "number" || typeof ver !== "number") return null;
    if (sch !== null && typeof sch !== "number") return null;
    if (!Array.isArray(roles) || !roles.every((r) => typeof r === "string")) return null;
    return { uid, sch, roles: roles as Role[], ver };
  } catch {
    return null;
  }
}
