// How a password-reset code reaches the user.
// For now: printed in the server terminal during development only.
// Task T5.8 replaces this with SMS (user's phone, or a student's primary
// guardian) and email where available.

export type ResetRecipient = {
  userId: number;
  email: string | null;
  phone: string | null;
  username: string | null;
};

export type DeliverResetCode = (to: ResetRecipient, code: string) => Promise<void>;

export const deliverResetCode: DeliverResetCode = async (to, code) => {
  const who = to.email ?? to.phone ?? to.username ?? `user #${to.userId}`;
  if (process.env.NODE_ENV === "production") {
    // Never print codes in production. Until SMS exists, the school admin
    // resets passwords from the Users page (task T2.13).
    console.warn(`[password-reset] code requested for ${who}, but no SMS/email delivery is set up yet`);
    return;
  }
  console.log(`\n[DEV] Password reset code for ${who}: ${code}  (valid 10 minutes)\n`);
};
