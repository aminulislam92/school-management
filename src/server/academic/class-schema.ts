// Rules for the class and group forms. No database access, so the browser
// forms can import them too.
import type { Level } from "@prisma/client";
import { z } from "zod";

export const LEVEL_ORDER: readonly Level[] = ["PRE_PRIMARY", "PRIMARY", "SECONDARY", "HIGHER_SECONDARY"];

/** Groups (Science, Humanities ...) only exist from Class Nine (order 12) upward — US-2.3. */
export const FIRST_GROUP_ORDER = 12;
export const canHaveGroups = (order: number) => order >= FIRST_GROUP_ORDER;

const name = z.string().trim().min(1, { message: "name" }).max(40, { message: "name" });

export const ClassInput = z.object({
  nameBn: name,
  nameEn: name,
  hasGroups: z.string().transform((v) => v === "on"),
});
export type ClassInput = z.infer<typeof ClassInput>;

export const GroupInput = z.object({ nameBn: name, nameEn: name });
export type GroupInput = z.infer<typeof GroupInput>;

export function parseClassForm(formData: FormData) {
  return ClassInput.safeParse({
    nameBn: String(formData.get("nameBn") ?? ""),
    nameEn: String(formData.get("nameEn") ?? ""),
    hasGroups: String(formData.get("hasGroups") ?? ""),
  });
}

export function parseGroupForm(formData: FormData) {
  return GroupInput.safeParse({ nameBn: String(formData.get("nameBn") ?? ""), nameEn: String(formData.get("nameEn") ?? "") });
}
