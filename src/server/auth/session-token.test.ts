import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { secretKey, signSession, verifySession } from "./session-token";

const key = secretKey("test-secret-that-is-long-enough-1234567890");
const otherKey = secretKey("another-secret-that-is-long-enough-0987654321");

describe("session token", () => {
  it("round-trips the payload", async () => {
    const token = await signSession({ uid: 5, sch: 2, roles: ["ADMIN"] }, key);
    expect(await verifySession(token, key)).toEqual({ uid: 5, sch: 2, roles: ["ADMIN"] });
  });

  it("keeps sch = null for the super admin", async () => {
    const token = await signSession({ uid: 1, sch: null, roles: ["SUPER_ADMIN"] }, key);
    expect((await verifySession(token, key))?.sch).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession({ uid: 5, sch: 2, roles: ["ADMIN"] }, otherKey);
    expect(await verifySession(token, key)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ uid: 5, sch: 2, roles: ["TEACHER"] }, key);
    const [h, , s] = token.split(".");
    const fakeBody = Buffer.from(JSON.stringify({ uid: 5, sch: 2, roles: ["ADMIN"] })).toString("base64url");
    expect(await verifySession(`${h}.${fakeBody}.${s}`, key)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT({ uid: 5, sch: 2, roles: ["ADMIN"] })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    expect(await verifySession(token, key)).toBeNull();
  });

  it("rejects missing or garbage tokens", async () => {
    expect(await verifySession(undefined, key)).toBeNull();
    expect(await verifySession("not-a-token", key)).toBeNull();
  });

  it("refuses a short secret", () => {
    expect(() => secretKey("short")).toThrow(/AUTH_SECRET/);
  });
});
