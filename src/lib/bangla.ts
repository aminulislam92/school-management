const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** "2026-0001" → "২০২৬-০০০১". Non-digit characters are kept. */
export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** "২০২৬" → "2026". Useful when a user types Bangla digits into a form. */
export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Normalise a Bangladeshi mobile number to 01XXXXXXXXX (11 digits).
 * Accepts +8801..., 8801..., 01..., spaces, dashes and Bangla digits.
 * Returns null when the number is not a valid BD mobile number.
 */
export function normalizeBdPhone(input: string): string | null {
  let digits = toEnglishDigits(input).replace(/[^0-9]/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}
