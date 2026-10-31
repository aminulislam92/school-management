// Development seed: one plan, one SUPER_ADMIN, and a "demo" school with its
// default master data and one user per staff role. Safe to run more than once.
// Run with: npm run db:seed
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  BD_GRADE_SCALE,
  DEFAULT_CLASSES,
  DEFAULT_FEE_TYPES,
  DEFAULT_GROUPS,
  DEFAULT_SMS_TEMPLATES,
} from "./defaults";

const db = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@example.com";
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123";
const DEMO_ADMIN_EMAIL = process.env.SEED_DEMO_ADMIN_EMAIL ?? "admin@demo.school";
const DEMO_ADMIN_PASSWORD = process.env.SEED_DEMO_ADMIN_PASSWORD ?? "Admin@12345";
const DEMO_STAFF_PASSWORD = process.env.SEED_DEMO_STAFF_PASSWORD ?? "Staff@12345";

async function main() {
  // 1. Plan
  const plan =
    (await db.plan.findFirst({ where: { name: "Starter" } })) ??
    (await db.plan.create({
      data: {
        name: "Starter",
        price: "1500.00",
        billingCycle: "MONTHLY",
        maxStudents: 500,
        features: ["attendance", "fees", "exams", "sms", "portal"],
      },
    }));

  // 2. Super admin (belongs to no school)
  let superAdmin = await db.user.findFirst({
    where: { schoolId: null, email: SUPER_ADMIN_EMAIL },
  });
  if (!superAdmin) {
    superAdmin = await db.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12),
        mustChangePassword: true,
        roles: { create: { role: "SUPER_ADMIN" } },
      },
    });
  }

  // 3. Demo school + settings
  const school = await db.school.upsert({
    where: { code: "demo" },
    update: {},
    create: {
      code: "demo",
      nameBn: "ডেমো উচ্চ বিদ্যালয় ও কলেজ",
      nameEn: "Demo High School & College",
      eiin: "100000",
      board: "Dhaka",
      levels: ["PRE_PRIMARY", "PRIMARY", "SECONDARY", "HIGHER_SECONDARY"],
      phone: "01700000000",
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Dhanmondi",
      setting: { create: { weeklyHolidays: ["FRI"], studentLoginFromOrder: 9 } },
    },
  });
  const schoolId = school.id;

  // 4. Subscription (30-day trial)
  const hasSubscription = await db.subscription.findFirst({ where: { schoolId } });
  if (!hasSubscription) {
    const now = new Date();
    await db.subscription.create({
      data: {
        schoolId,
        planId: plan.id,
        status: "TRIAL",
        startsAt: now,
        endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 5. Master data
  for (const c of DEFAULT_CLASSES) {
    await db.schoolClass.upsert({
      where: { schoolId_order: { schoolId, order: c.order } },
      update: {},
      create: { schoolId, ...c },
    });
  }

  for (const g of DEFAULT_GROUPS) {
    await db.group.upsert({
      where: { schoolId_nameEn: { schoolId, nameEn: g.nameEn } },
      update: {},
      create: { schoolId, ...g },
    });
  }

  for (const f of DEFAULT_FEE_TYPES) {
    await db.feeType.upsert({
      where: { schoolId_nameEn: { schoolId, nameEn: f.nameEn } },
      update: {},
      create: { schoolId, ...f },
    });
  }

  for (const t of DEFAULT_SMS_TEMPLATES) {
    await db.smsTemplate.upsert({
      where: { schoolId_key: { schoolId, key: t.key } },
      update: {},
      create: { schoolId, ...t },
    });
  }

  const hasScale = await db.gradeScale.findFirst({ where: { schoolId, isDefault: true } });
  if (!hasScale) {
    await db.gradeScale.create({
      data: {
        schoolId,
        name: BD_GRADE_SCALE.name,
        isDefault: true,
        items: { create: BD_GRADE_SCALE.items },
      },
    });
  }

  // 6. Current academic session (Jan–Dec of this year)
  const year = new Date().getFullYear();
  await db.academicSession.upsert({
    where: { schoolId_type_name: { schoolId, type: "SCHOOL", name: String(year) } },
    update: {},
    create: {
      schoolId,
      name: String(year),
      type: "SCHOOL",
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-12-31`),
      isCurrent: true,
    },
  });

  // 7. Demo school staff: one user per role, to try out menus and permissions
  const demoStaff: {
    email: string;
    password: string;
    roles: Role[];
    nameEn: string;
    nameBn: string;
    designation: string;
    phone: string;
  }[] = [
    {
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      roles: ["ADMIN"],
      nameEn: "Demo Head Teacher",
      nameBn: "ডেমো প্রধান শিক্ষক",
      designation: "Head Teacher",
      phone: "01700000001",
    },
    {
      email: "teacher@demo.school",
      password: DEMO_STAFF_PASSWORD,
      roles: ["TEACHER", "CLASS_TEACHER"],
      nameEn: "Demo Teacher",
      nameBn: "ডেমো শিক্ষক",
      designation: "Assistant Teacher",
      phone: "01700000002",
    },
    {
      email: "accountant@demo.school",
      password: DEMO_STAFF_PASSWORD,
      roles: ["ACCOUNTANT"],
      nameEn: "Demo Accountant",
      nameBn: "ডেমো হিসাবরক্ষক",
      designation: "Accountant",
      phone: "01700000003",
    },
    {
      email: "office@demo.school",
      password: DEMO_STAFF_PASSWORD,
      roles: ["OFFICE_STAFF"],
      nameEn: "Demo Office Assistant",
      nameBn: "ডেমো অফিস সহকারী",
      designation: "Office Assistant",
      phone: "01700000004",
    },
  ];

  for (const s of demoStaff) {
    const exists = await db.user.findFirst({ where: { schoolId, email: s.email } });
    if (exists) continue;
    await db.user.create({
      data: {
        schoolId,
        email: s.email,
        passwordHash: await bcrypt.hash(s.password, 12),
        mustChangePassword: true,
        roles: { create: s.roles.map((role) => ({ role })) },
        staff: {
          create: {
            schoolId,
            nameEn: s.nameEn,
            nameBn: s.nameBn,
            designation: s.designation,
            phone: s.phone,
          },
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log(`  Super admin: ${SUPER_ADMIN_EMAIL}  (http://localhost:3000/login)`);
  console.log(`  Demo school: http://demo.localhost:3000/login`);
  for (const s of demoStaff) console.log(`    ${s.roles.join("+").padEnd(22)} ${s.email}`);
  console.log("  Passwords: SEED_* values in .env, or the defaults at the top of prisma/seed.ts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
