// Creating and listing schools (super admin only). Uses the plain `db`:
// the super admin works across schools.
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import {
  BD_GRADE_SCALE,
  DEFAULT_CLASSES,
  DEFAULT_FEE_TYPES,
  DEFAULT_GROUPS,
  DEFAULT_SMS_TEMPLATES,
} from "@/server/school-defaults";
import type { NewSchoolErrors, NewSchoolInput } from "./school-schema";

export * from "./school-schema";

// No 0/O, 1/l/I: easy to read out over the phone.
const TEMP_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A readable 10-character temporary password with letters and digits. */
export function generateTempPassword(): string {
  for (;;) {
    let pw = "";
    for (let i = 0; i < 10; i++) pw += TEMP_CHARS[randomInt(TEMP_CHARS.length)];
    if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) return pw;
  }
}

export type CreateSchoolResult =
  | { ok: true; schoolId: number; code: string; adminLogin: string; tempPassword: string }
  | { ok: false; errors: NewSchoolErrors };

/**
 * Creates a school with everything it needs to start, in ONE transaction:
 * school + settings, classes and groups for its levels, grade scale, fee types,
 * SMS templates, the current session, a trial subscription and the first ADMIN.
 * If any step fails, nothing is saved.
 */
export async function createSchool(
  input: NewSchoolInput,
  actorId: number,
  now = new Date(),
): Promise<CreateSchoolResult> {
  if (await db.school.findUnique({ where: { code: input.code }, select: { id: true } })) {
    return { ok: false, errors: { code: "codeTaken" } };
  }
  const plan = await db.plan.findUnique({ where: { id: input.planId }, select: { isActive: true } });
  if (!plan?.isActive) return { ok: false, errors: { planId: "plan" } };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const hasGroups = input.levels.some((l) => l === "SECONDARY" || l === "HIGHER_SECONDARY");
  const year = now.getFullYear();

  const school = await db.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        code: input.code,
        nameBn: input.nameBn,
        nameEn: input.nameEn,
        eiin: input.eiin,
        board: input.board,
        levels: input.levels,
        phone: input.phone,
        email: input.email,
        district: input.district,
        upazila: input.upazila,
        setting: {
          create: {
            weeklyHolidays: ["FRI"],
            // Students log in from Class Six (order 9) when the school has secondary classes.
            studentLoginFromOrder: hasGroups ? 9 : null,
          },
        },
      },
    });
    const schoolId = school.id;

    await tx.schoolClass.createMany({
      data: DEFAULT_CLASSES.filter((c) => input.levels.includes(c.level)).map((c) => ({ schoolId, ...c })),
    });
    if (hasGroups) {
      await tx.group.createMany({ data: DEFAULT_GROUPS.map((g) => ({ schoolId, ...g })) });
    }
    await tx.feeType.createMany({ data: DEFAULT_FEE_TYPES.map((f) => ({ schoolId, ...f })) });
    await tx.smsTemplate.createMany({ data: DEFAULT_SMS_TEMPLATES.map((t) => ({ schoolId, ...t })) });
    await tx.gradeScale.create({
      data: { schoolId, name: BD_GRADE_SCALE.name, isDefault: true, items: { create: BD_GRADE_SCALE.items } },
    });
    await tx.academicSession.create({
      data: {
        schoolId,
        name: String(year),
        type: "SCHOOL",
        startDate: new Date(`${year}-01-01`),
        endDate: new Date(`${year}-12-31`),
        isCurrent: true,
      },
    });
    await tx.subscription.create({
      data: {
        schoolId,
        planId: input.planId,
        status: "TRIAL",
        startsAt: now,
        endsAt: new Date(now.getTime() + input.trialDays * 24 * 60 * 60_000),
      },
    });
    await tx.user.create({
      data: {
        schoolId,
        email: input.adminEmail,
        phone: input.adminPhone,
        passwordHash,
        mustChangePassword: true,
        roles: { create: { role: "ADMIN" } },
        staff: {
          create: {
            schoolId,
            nameEn: input.adminNameEn,
            nameBn: input.adminNameBn,
            designation: "Head Teacher",
            phone: input.adminPhone ?? input.phone ?? "",
            email: input.adminEmail,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId: actorId,
        action: "CREATE",
        entity: "School",
        entityId: String(schoolId),
        after: { code: input.code, nameEn: input.nameEn, planId: input.planId, levels: input.levels },
      },
    });
    return school;
  });

  return {
    ok: true,
    schoolId: school.id,
    code: school.code,
    adminLogin: input.adminEmail ?? input.adminPhone ?? "",
    tempPassword,
  };
}

export function listSchools() {
  return db.school.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      nameBn: true,
      nameEn: true,
      status: true,
      createdAt: true,
      _count: { select: { students: true } },
      subscriptions: {
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { status: true, endsAt: true, plan: { select: { name: true } } },
      },
    },
  });
}

export function listActivePlans() {
  return db.plan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
    select: { id: true, name: true, price: true, billingCycle: true, maxStudents: true },
  });
}
