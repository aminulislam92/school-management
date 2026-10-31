import { describe, expect, it } from "vitest";
import {
  admissionErrors,
  admissionFromForm,
  admissionWarnings,
  ageOn,
  EnrollmentInput,
  GuardiansInput,
  parseAdmissionForm,
  StudentInput,
} from "./admission-schema";

const student = (over: Record<string, unknown> = {}) => ({
  nameBn: "মোঃ রহিম উদ্দিন", nameEn: "Md. Rahim Uddin", dateOfBirth: "2014-03-15", gender: "MALE", religion: "ISLAM",
  bloodGroup: "", birthRegNo: "", presentAddress: "", permanentAddress: "", sameAddress: false, previousSchool: "", admissionDate: "2026-01-05", ...over,
});
const guardian = (over: Record<string, unknown> = {}) => ({ relation: "FATHER", name: "করিম উদ্দিন", phone: "01712345678", nid: "", occupation: "", isPrimary: true, ...over });
const enrollment = (over: Record<string, unknown> = {}) => ({ sessionId: "1", sectionId: "2", roll: "5", groupId: "", electiveSubjectIds: [], optionalSubjectId: "", ...over });
const codes = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message));

describe("student", () => {
  it("cleans a normal student", () => {
    const r = StudentInput.parse(student({ birthRegNo: "২০১৪ ২৬১১ ৫২৩৪ ৫৬৭৮৯", nameEn: "  Md.   Rahim  Uddin ", bloodGroup: "B_POS", presentAddress: " গ্রাম: ক, ঢাকা ", sameAddress: true }));
    expect(r).toMatchObject({ birthRegNo: "20142611523456789", nameEn: "Md. Rahim Uddin", bloodGroup: "B_POS", presentAddress: "গ্রাম: ক, ঢাকা", permanentAddress: "গ্রাম: ক, ঢাকা", previousSchool: null });
    expect(r).not.toHaveProperty("sameAddress");
  });

  it("checks names, numbers and dates", () => {
    expect(codes(StudentInput.safeParse(student({ nameBn: "Rahim" })))).toEqual(["nameBnScript"]);
    expect(codes(StudentInput.safeParse(student({ nameEn: "রহিম" })))).toEqual(["nameEnScript"]);
    expect(codes(StudentInput.safeParse(student({ birthRegNo: "1234567890" })))).toEqual(["birthRegNo"]);
    expect(codes(StudentInput.safeParse(student({ dateOfBirth: "2026-02-01" })))).toEqual(["bornAfterAdmission"]);
    expect(codes(StudentInput.safeParse(student({ dateOfBirth: "2014-02-30" })))).toEqual(["dateOfBirth"]);
    expect(codes(StudentInput.safeParse(student({ religion: "", gender: "X" })))).toEqual(["gender", "religion"]);
  });
});

describe("guardians", () => {
  it("accepts father + mother with one primary, any phone format", () => {
    const r = GuardiansInput.parse([guardian({ phone: "+৮৮০ ১৭১২-৩৪৫৬৭৮", nid: "1234567890" }), guardian({ relation: "MOTHER", name: "রহিমা বেগম", phone: "01812345678", isPrimary: false })]);
    expect(r.map((g) => [g.relation, g.phone, g.nid])).toEqual([["FATHER", "01712345678", "1234567890"], ["MOTHER", "01812345678", null]]);
  });

  it("needs exactly one primary, different numbers, one father and one mother at most", () => {
    expect(codes(GuardiansInput.safeParse([]))).toContain("noGuardian");
    expect(codes(GuardiansInput.safeParse([guardian({ isPrimary: false })]))).toEqual(["onePrimary"]);
    expect(codes(GuardiansInput.safeParse([guardian(), guardian({ relation: "MOTHER" })]))).toEqual(["onePrimary", "samePhone"]);
    expect(codes(GuardiansInput.safeParse([guardian(), guardian({ isPrimary: false, phone: "01912345678" })]))).toEqual(["twoParents"]);
    expect(codes(GuardiansInput.safeParse([guardian({ phone: "12345" })]))).toEqual(["phone"]);
    expect(codes(GuardiansInput.safeParse([guardian({ nid: "12345" })]))).toEqual(["nid"]);
  });
});

describe("enrollment", () => {
  it("roll in Bangla digits; the 4th subject must be one of the electives taken", () => {
    expect(EnrollmentInput.parse(enrollment({ roll: "১২" })).roll).toBe(12);
    expect(EnrollmentInput.parse(enrollment({ electiveSubjectIds: ["7", "8", "7"], optionalSubjectId: "8", groupId: "3" }))).toMatchObject({ electiveSubjectIds: [7, 8], optionalSubjectId: 8, groupId: 3 });
    expect(codes(EnrollmentInput.safeParse(enrollment({ electiveSubjectIds: ["7"], optionalSubjectId: "9" })))).toEqual(["fourthNotTaken"]);
    expect(codes(EnrollmentInput.safeParse(enrollment({ roll: "0" })))).toEqual(["roll"]);
    expect(codes(EnrollmentInput.safeParse(enrollment({ sectionId: "" })))).toEqual(["section"]);
  });
});

describe("the admission form", () => {
  const form = (fields: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) f.append(k, one);
    return f;
  };
  const base = {
    "student.nameBn": "রহিম", "student.nameEn": "Rahim", "student.dateOfBirth": "2014-03-15", "student.gender": "MALE", "student.religion": "ISLAM",
    "student.admissionDate": "2026-01-05",
    "guardians.0.relation": "FATHER", "guardians.0.name": "করিম", "guardians.0.phone": "01712345678",
    "guardians.1.relation": "MOTHER", "guardians.1.name": "", "guardians.1.phone": "", // empty row: skipped
    primaryGuardian: "0",
    "enrollment.sessionId": "1", "enrollment.sectionId": "2", "enrollment.roll": "3",
  };

  it("reads nested fields and skips empty guardian rows", () => {
    const r = parseAdmissionForm(form(base));
    expect(r.success).toBe(true);
    expect(r.data?.guardians).toHaveLength(1);
    expect(r.data?.guardians[0].isPrimary).toBe(true);
    expect(admissionFromForm(form({ ...base, "enrollment.electiveSubjectIds": ["7", "8"] })).enrollment.electiveSubjectIds).toEqual(["7", "8"]);
  });

  it("reports errors by field path", () => {
    const r = parseAdmissionForm(form({ ...base, "student.nameEn": "রহিম", "guardians.0.phone": "123", primaryGuardian: "" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(admissionErrors(r.error)).toEqual({ "student.nameEn": "nameEnScript", "guardians.0.phone": "phone", guardians: "onePrimary" });
  });
});

describe("warnings", () => {
  it("age and birth-registration year", () => {
    expect(ageOn("2014-03-15", "2026-03-14")).toBe(11);
    expect(ageOn("2014-03-15", "2026-03-15")).toBe(12);
    const s = { dateOfBirth: "2014-03-15", admissionDate: "2026-01-05", birthRegNo: "20142611523456789" };
    expect(admissionWarnings(s, 9)).toEqual([]); // 11 years old in Class Six: fine
    expect(admissionWarnings(s, 1)).toEqual(["ageForClass"]); // 11 years old in Play
    expect(admissionWarnings({ ...s, birthRegNo: "20152611523456789" }, 9)).toEqual(["birthRegYear"]);
  });
});

describe("messages", () => {
  it("every error and warning code has Bangla and English text", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./admission-schema.ts", import.meta.url), "utf8");
    const codes = new Set([...src.matchAll(/message: "([a-zA-Z]+)"/g)].map((m) => m[1]));
    for (const lang of ["bn", "en"]) {
      const m = JSON.parse(readFileSync(new URL(`../../../messages/${lang}.json`, import.meta.url), "utf8"));
      expect([...codes].filter((c) => !m.admission.errors[c]), lang).toEqual([]);
      expect(Object.keys(m.admission.warnings).sort(), lang).toEqual(["ageForClass", "birthRegYear"]);
    }
  });
});
