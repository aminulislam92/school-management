// Rules for a new password. Kept simple on purpose: long enough, not trivially
// guessable, and different from the old one. Used by the form and the server.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 100;

export type PasswordProblem =
  | "tooShort"
  | "tooLong"
  | "needsLetterAndNumber"
  | "tooCommon"
  | "sameAsOld"
  | "mismatch";

// Passwords people really use in Bangladesh school offices. Checked case-insensitively.
const COMMON = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "abcd1234",
  "qwerty123",
  "bangladesh",
  "bangladesh1",
  "school123",
  "admin123",
  "admin1234",
]);

export function checkNewPassword(input: {
  next: string;
  confirm: string;
  current?: string;
}): PasswordProblem | null {
  const { next, confirm, current } = input;
  if (next.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (next.length > MAX_PASSWORD_LENGTH) return "tooLong";
  if (!/\p{L}/u.test(next) || !/\p{N}/u.test(next)) return "needsLetterAndNumber";
  if (COMMON.has(next.toLowerCase())) return "tooCommon";
  if (current !== undefined && next === current) return "sameAsOld";
  if (next !== confirm) return "mismatch";
  return null;
}
