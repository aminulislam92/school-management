"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentSchool, getTenantHost } from "@/lib/tenant";
import { authenticate } from "./authenticate";
import { createSession, deleteSession, homePathFor } from "./dal";

export type LoginState = {
  error?: "required" | "invalid" | "locked" | "inactive" | "noSchool";
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

  await createSession({ uid: result.user.id, sch: result.user.schoolId, roles: result.user.roles });
  redirect(homePathFor(result.user.roles));
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
