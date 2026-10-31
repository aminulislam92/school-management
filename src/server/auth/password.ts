import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// When the user doesn't exist we still compare against this hash, so a wrong
// email takes as long as a wrong password and can't be told apart by timing.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  await bcrypt.compare(plain, await dummyHash);
}
