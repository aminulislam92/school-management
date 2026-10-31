"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/dal";
import { SchoolStatusInput } from "./school-schema";
import { setSchoolStatus } from "./schools";

export type SchoolStatusState = { error?: "reason" | "status" | "notFound"; reason?: string; done?: number };

export async function setSchoolStatusAction(_prev: SchoolStatusState, formData: FormData): Promise<SchoolStatusState> {
  const user = await assertPermission("super.manage");
  const reason = String(formData.get("reason") ?? "");

  const parsed = SchoolStatusInput.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    reason,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "reason" ? "reason" : field === "status" ? "status" : "notFound", reason };
  }

  const result = await setSchoolStatus(parsed.data, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/super/schools/${parsed.data.id}`);
  revalidatePath("/super/schools");
  return { done: Date.now() }; // a new value each time, so the form can show "saved"
}
