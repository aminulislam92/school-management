"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentSchool, getTenantHost } from "@/lib/tenant";
import { authenticate } from "./authenticate";
import { changePassword, type ChangePasswordResult } from "./change-password";
import { createSession, deleteSession, getCurrentUser, homePathFor } from "./dal";
import { requestPasswordReset, resetPassword, type ResetResult } from "./password-reset";

export type LoginState = {
  error?: "required" | "invalid" | "locked" | "inactive" | "noSchool" | "schoolClosed" | "studentLoginOff";
  minutes?: number;
  identifier?: string;
};

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  const identifier = String(formData.get("identifier") ?? "");
  if (!parsed.success) return { error: "required", identifier };

  // The school comes from the domain, never from the form.
  const tenant = await getTenantHost();
  let schoolId: number | null = null;
  if (tenant.kind !== "root") {
    const school = await getCurrentSchool();
    if (!school) return { error: "noSchool", identifier };
    if (school.status !== "ACTIVE") return { error: "schoolClosed", identifier };
    schoolId = school.id;
  }

  const result = await authenticate({ ...parsed.data, schoolId });

  if (!result.ok) {
    if (result.reason === "locked") {
      const minutes = Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 60_000));
      return { error: "locked", minutes, identifier };
    }
    return { error: result.reason, identifier };
  }

  const { id, schoolId: sch, roles, sessionVersion, mustChangePassword } = result.user;
  await createSession({ uid: id, sch, roles, ver: sessionVersion });
  redirect(mustChangePassword ? "/change-password" : homePathFor(roles));
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export type ChangePasswordState = {
  error?: Extract<ChangePasswordResult, { ok: false }>["problem"];
};

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await changePassword({
    userId: user.id,
    schoolId: user.schoolId,
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!result.ok) return { error: result.problem };

  // Other devices are now logged out; give this device a fresh cookie.
  await createSession({ uid: user.id, sch: user.schoolId, roles: user.roles, ver: result.sessionVersion });
  redirect(homePathFor(user.roles));
}

export type ForgotPasswordState = {
  step: "request" | "code" | "done";
  identifier?: string;
  error?: "required" | "schoolClosed" | Extract<ResetResult, { ok: false }>["problem"];
};

/** One action for both steps of /forgot-password (the form sends `step`). */
export async function forgotPasswordAction(
  prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { step: "request", error: "required" };

  // The school comes from the domain, never from the form.
  const tenant = await getTenantHost();
  let schoolId: number | null = null;
  if (tenant.kind !== "root") {
    const school = await getCurrentSchool();
    if (!school) return { step: "request", identifier, error: "invalidCode" };
    if (school.status !== "ACTIVE") return { step: "request", identifier, error: "schoolClosed" };
    schoolId = school.id;
  }

  if (formData.get("step") === "request") {
    await requestPasswordReset({ identifier, schoolId });
    return { step: "code", identifier };
  }

  const result = await resetPassword({
    identifier,
    schoolId,
    code: String(formData.get("code") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  return result.ok ? { step: "done" } : { step: "code", identifier, error: result.problem };
}
