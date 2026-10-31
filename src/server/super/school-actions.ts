"use server";

import { headers } from "next/headers";
import { assertPermission } from "@/server/auth/dal";
import { newSchoolErrors, parseNewSchoolForm, type NewSchoolErrors } from "./school-schema";
import { createSchool } from "./schools";

export type NewSchoolValues = Record<string, string | string[]>;

export type NewSchoolState = {
  errors?: NewSchoolErrors;
  values?: NewSchoolValues;
  created?: {
    code: string;
    nameBn: string;
    url: string;
    adminLogin: string;
    tempPassword: string; // shown once, never stored in plain text
  };
};

function submittedValues(formData: FormData): NewSchoolValues {
  const out: NewSchoolValues = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React's internal fields
    const all = formData.getAll(key).map(String);
    out[key] = key === "levels" ? all : (all[0] ?? "");
  }
  return out;
}

/** "localhost:3000" → "http://demo.localhost:3000", "yourapp.com" → "https://demo.yourapp.com" */
async function schoolUrl(code: string) {
  const h = await headers();
  const host = (h.get("host") ?? "localhost:3000").replace(/^www\./, "");
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${code}.${host}`;
}

export async function createSchoolAction(_prev: NewSchoolState, formData: FormData): Promise<NewSchoolState> {
  const user = await assertPermission("super.manage");

  const parsed = parseNewSchoolForm(formData);
  if (!parsed.success) return { errors: newSchoolErrors(parsed.error), values: submittedValues(formData) };

  const result = await createSchool(parsed.data, user.id);
  if (!result.ok) return { errors: result.errors, values: submittedValues(formData) };

  return {
    created: {
      code: result.code,
      nameBn: parsed.data.nameBn,
      url: await schoolUrl(result.code),
      adminLogin: result.adminLogin,
      tempPassword: result.tempPassword,
    },
  };
}
