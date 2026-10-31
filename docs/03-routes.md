# 03-routes — পেজ, Server Action ও API

> Version: 0.1 · Date: 2026-10-31
> ভিত্তি: `docs/01-PRD.md` (v0.3), `prisma/schema.prisma`
> নিয়ম: ডেটা পড়া হবে Server Component-এ, ফর্ম সাবমিট ও পরিবর্তন হবে Server Action-এ। Route Handler (`/api/...`) শুধু সেখানে, যেখানে বাইরের কেউ কল করে (SMS ওয়েবহুক, Android গেটওয়ে, cron) অথবা ফাইল ফেরত দিতে হয় (PDF, Excel)।

---

## 1. ডোমেইন ও স্কুল চেনা (Multi-tenant routing)

| URL | কী |
| --- | --- |
| `yourapp.com` | প্রোডাক্টের পরিচিতি পেজ (পরে) ও সুপার অ্যাডমিন লগইন |
| `yourapp.com/super/...` | সুপার অ্যাডমিন প্যানেল |
| `{schoolCode}.yourapp.com/...` | একটা নির্দিষ্ট স্কুলের অ্যাপ |

- `src/proxy.ts` (Next.js 16; পুরনো ভার্সনে `middleware.ts`) হোস্টনেম থেকে `schoolCode` বের করে রিকোয়েস্ট হেডারে বসাবে।
- `getCurrentSchool()` হেডার থেকে কোড নিয়ে ডাটাবেস থেকে স্কুল আনবে; স্কুল না পেলে বা SUSPENDED/CLOSED হলে নির্দিষ্ট পেজ দেখাবে।
- লোকাল ডেভেলপমেন্টে: `demo.localhost:3000` (ব্রাউজার `*.localhost` নিজেই চেনে)।
- লগইন করা ইউজারের `schoolId` আর সাবডোমেইনের স্কুল না মিললে সেশন বাতিল।

---

## 2. ফোল্ডার কাঠামো

```text
src/
  proxy.ts                      # subdomain → schoolCode, auth redirect
  app/
    (auth)/                     # login, OTP, password pages
    super/                      # SUPER_ADMIN panel
    admin/                      # school staff panel (ADMIN, OFFICE_STAFF, ACCOUNTANT, TEACHER, CLASS_TEACHER)
    portal/                     # STUDENT and GUARDIAN portal (mobile-first)
    api/                        # route handlers (webhooks, gateway, cron, files)
  server/
    actions/                    # server actions, one file per module
    services/                   # business logic: gpa.ts, fees.ts, late-fee.ts, promotion.ts ...
    sms/                        # adapter.ts, drivers/provider-api.ts, drivers/mobile-gateway.ts, providers/*
    pdf/                        # marksheet, receipt, id-card, admit-card templates
    queries/                    # reusable read queries for server components
  lib/
    db.ts                       # Prisma client + tenant extension (auto schoolId)
    auth.ts                     # Auth.js config (credentials + OTP)
    permissions.ts              # role → permission map, can(), requireRole()
    tenant.ts                   # getCurrentSchool()
    validation/                 # zod schemas shared by forms and actions
    i18n/                       # bn.json, en.json
  components/                   # ui (shadcn), forms, tables, layout
```

---

## 3. লগইন পেজ — `(auth)`

| পেজ | কে | কাজ | US |
| --- | --- | --- | --- |
| `/login` | স্টাফ, শিক্ষার্থী | ইমেইল/ফোন/Student ID + পাসওয়ার্ড | 1.1, 1.3 |
| `/login/guardian` | অভিভাবক | মোবাইল নম্বর → OTP | 1.2 |
| `/forgot-password` | স্টাফ, শিক্ষার্থী, সুপার অ্যাডমিন | ধাপ ১: ৬ সংখ্যার কোড পাঠানো; ধাপ ২: কোড + নতুন পাসওয়ার্ড (একই পেজে) | 1.5 |
| `/change-password` | সবাই | পাসওয়ার্ড বদল (প্রথম লগইনে বাধ্যতামূলক) | 1.3, 1.5 |
| `/suspended` | সবাই | সাবস্ক্রিপশন বন্ধের বার্তা | 0.3 |

**Actions — `server/actions/auth.ts`**

| Action | কাজ |
| --- | --- |
| `requestOtp(phone)` | অভিভাবক আছে কিনা দেখে OTP তৈরি ও SMS কিউতে; ১ ঘণ্টায় ৫টার বেশি নয় |
| `verifyOtp(phone, code)` | OTP যাচাই, লগইন সেশন |
| `changePassword(old, new)` | পাসওয়ার্ড বদল, `mustChangePassword = false` |
| `requestPasswordReset(identifier)` / `resetPassword(token, new)` | পাসওয়ার্ড রিসেট |

লগইন ও লগআউট Server Action দিয়ে (`loginAction`, `logoutAction` — `src/server/auth/actions.ts`); সেশন `jose` দিয়ে সাইন করা কুকি। ৫ বার ভুলে ১৫ মিনিট লক।

---

## 4. সুপার অ্যাডমিন — `/super` (শুধু SUPER_ADMIN)

| পেজ | কাজ | US |
| --- | --- | --- |
| `/super` | সব স্কুলের সারাংশ: সক্রিয় স্কুল, শিক্ষার্থী, মেয়াদোত্তীর্ণ, এই মাসের আয় | 0.5 |
| `/super/schools` | স্কুল তালিকা, স্ট্যাটাস ফিল্টার | 0.1 |
| `/super/schools/new` | নতুন স্কুল + প্রথম ADMIN | 0.1 |
| `/super/schools/[id]` | স্কুলের তথ্য, সাবস্ক্রিপশন ইতিহাস, SMS ক্রেডিট, স্ট্যাটাস বদল | 0.3, 0.4 |
| `/super/plans` | প্ল্যান তালিকা ও এডিট | 0.2 |
| `/super/subscriptions` | মেয়াদ শেষের পথে ও GRACE অবস্থার স্কুল | 0.3 |

**Actions — `server/actions/super.ts`**

| Action | কাজ |
| --- | --- |
| `createSchool(data)` | স্কুল + SchoolSetting + ডিফল্ট মাস্টার ডেটা (ক্লাস, গ্রেড স্কেল, ফি-এর ধরন, SMS টেমপ্লেট) + ADMIN ইউজার, এক ট্রানজ্যাকশনে |
| `updateSchool(id, data)` / `setSchoolStatus(id, status)` | তথ্য ও স্ট্যাটাস |
| `createPlan` / `updatePlan` | প্ল্যান |
| `createSubscription(schoolId, planId, dates)` / `recordSubscriptionPayment(...)` | সাবস্ক্রিপশন ও পেমেন্ট এন্ট্রি |
| `addSmsCredits(schoolId, credits, amount)` | SMS ক্রেডিট যোগ |

---

## 5. স্কুল প্যানেল — `/admin`

মেনু রোল অনুযায়ী দেখাবে; প্রতিটি Action-এর ভেতরে আবার `requireRole()` চেক হবে।
নিচে "রোল" কলামে সংক্ষেপ: **A** = ADMIN, **O** = OFFICE_STAFF, **C** = ACCOUNTANT, **T** = TEACHER, **CT** = CLASS_TEACHER।

### 5.1 ড্যাশবোর্ড

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin` | সবাই | রোল অনুযায়ী কার্ড: শিক্ষার্থী সংখ্যা, আজকের উপস্থিতি, কালেকশন, বকেয়া, SMS ক্রেডিট ও গেটওয়ে, মেয়াদ, নোটিশ; শিক্ষকের জন্য "আজকের হাজিরা বাকি" | 10.1 |

### 5.2 সেটিংস — `server/actions/settings.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/settings/school` | A | স্কুল প্রোফাইল, লোগো, স্বাক্ষর | 2.1 |
| `/admin/settings/general` | A | ভাষা, সাপ্তাহিক ছুটি, শিক্ষার্থী লগইন কোন ক্লাস থেকে, শিক্ষার্থী ফি দেখবে কিনা, SMS চালু/বন্ধ | 1.3, 9.2 |
| `/admin/settings/sms` | A | প্রোভাইডার বাছাই ও API তথ্য সেভ, প্রাথমিক ড্রাইভার, ফলব্যাক, OTP ড্রাইভার, টেস্ট SMS | 8.3 |
| `/admin/settings/sms-devices` | A | Android গেটওয়ে ডিভাইস যোগ (টোকেন/QR), স্ট্যাটাস, রেট লিমিট | 8.3 |
| `/admin/settings/grade-scales` | A | গ্রেড স্কেল তৈরি ও এডিট | 7.3 |
| `/admin/settings/late-fees` | A | ফি-এর ধরন অনুযায়ী জরিমানার নিয়ম | 6.5 |

Actions: `updateSchoolProfile`, `updateGeneralSettings`, `saveSmsProvider`, `setActiveSmsProvider`, `sendTestSms`, `registerGatewayDevice`, `revokeGatewayDevice`, `saveGradeScale`, `saveLateFeeRule`

### 5.3 একাডেমিক সেটআপ — `server/actions/academic.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/academic/sessions` | A | session তৈরি, "চলতি" করা | 2.2 |
| `/admin/academic/classes` | A | ক্লাস, স্তর, ক্রম | 2.3 |
| `/admin/academic/groups` | A | গ্রুপ | 2.3 |
| `/admin/academic/sections` | A | সেকশন (ক্লাস + নাম + ভার্সন + শিফট + গ্রুপ) | 2.3 |
| `/admin/academic/subjects` | A | বিষয়, কোড, দুই-পত্রের বিষয় | 2.4 |
| `/admin/academic/class-subjects` | A | ক্লাস/গ্রুপ অনুযায়ী বিষয় ও নম্বর বণ্টন | 2.4 |
| `/admin/academic/teachers` | A | বিষয় শিক্ষক ও শ্রেণি শিক্ষক অ্যাসাইন | 2.5 |
| `/admin/academic/routine` | A | সেকশনের সাপ্তাহিক রুটিন গ্রিড, শিক্ষক ডাবল বুকিং চেক | 9.2 |
| `/admin/academic/holidays` | A | ছুটির তালিকা | 2.6 |

Actions: `saveSession`, `setCurrentSession`, `saveClass`, `saveGroup`, `saveSection`, `saveSubject`, `saveClassSubjects`, `assignSubjectTeacher`, `assignClassTeacher`, `saveRoutinePeriod`, `deleteRoutinePeriod`, `saveHoliday`, `deleteHoliday`

### 5.4 শিক্ষার্থী ও অভিভাবক — `server/actions/students.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/students` | A, O, C, CT | খোঁজা ও ফিল্টার, Excel/PDF এক্সপোর্ট | 3.3 |
| `/admin/students/new` | A, O | ভর্তি ফর্ম (শিক্ষার্থী + অভিভাবক + এনরোলমেন্ট) | 3.1, 3.2 |
| `/admin/students/[id]` | A, O, C, CT | প্রোফাইল ট্যাব: তথ্য, অভিভাবক, এনরোলমেন্ট ইতিহাস, হাজিরা, ফি, রেজাল্ট | 3.4 |
| `/admin/students/[id]/edit` | A, O | এডিট (অডিট লগসহ) | 3.4 |
| `/admin/students/[id]/tc` | A, O | TC ও "চলে গেছে" স্ট্যাটাস, বকেয়া সতর্কতা | 3.7 |
| `/admin/students/id-cards` | A, O | একজন বা পুরো সেকশনের আইডি কার্ড | 3.5 |
| `/admin/students/promotion` | A | session শেষে প্রমোশন উইজার্ড | 3.6 |
| `/admin/guardians` | A, O | অভিভাবক তালিকা, ফোন দিয়ে খোঁজা, পোর্টাল লগইন চালু | 3.2 |

Actions: `admitStudent`, `updateStudent`, `uploadStudentPhoto`, `findGuardianByPhone`, `linkGuardian`, `setPrimaryGuardian`, `issueTc`, `createStudentLogin`, `resetStudentPassword`, `previewPromotion`, `runPromotion`

### 5.5 স্টাফ ও ইউজার — `server/actions/staff.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/staff` | A | স্টাফ তালিকা | 4.1 |
| `/admin/staff/new`, `/admin/staff/[id]` | A | প্রোফাইল, লগইন অ্যাকাউন্ট ও রোল | 4.1, 1.4 |
| `/admin/staff/attendance` | A | স্টাফ হাজিরা | 4.2 |
| `/admin/users` | A | সব ইউজার, সক্রিয়/নিষ্ক্রিয়, পাসওয়ার্ড রিসেট | 1.4 |

Actions: `saveStaff`, `createStaffLogin`, `setUserRoles`, `setUserActive`, `adminResetPassword`, `saveStaffAttendance`

### 5.6 হাজিরা — `server/actions/attendance.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/attendance` | T, CT, A | সেকশন ও তারিখ বেছে মোবাইল-বান্ধব হাজিরা (ডিফল্ট উপস্থিত) | 5.1 |
| `/admin/attendance/report` | CT, A | মাসিক গ্রিড ও শতকরা হার, প্রিন্ট | 5.3 |

Actions: `saveAttendance(sectionId, date, entries)` → সেভের পর অনুপস্থিতদের SMS কিউতে (5.2)

### 5.7 ফি ও হিসাব — `server/actions/fees.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/fees/types` | A | ফি-এর ধরন | 6.1 |
| `/admin/fees/structures` | A | session × ক্লাস × গ্রুপ অনুযায়ী টাকা | 6.2 |
| `/admin/fees/discounts` | A | শিক্ষার্থীভিত্তিক ছাড় | 6.3 |
| `/admin/fees/invoices` | A, C | ইনভয়েস তালিকা ও ফিল্টার | 6.4 |
| `/admin/fees/invoices/generate` | A | হাতে ইনভয়েস তৈরি (পরীক্ষা ফি ইত্যাদি) | 6.4 |
| `/admin/fees/collect` | A, C | শিক্ষার্থী খুঁজে বকেয়া দেখা ও টাকা নেওয়া | 6.6 |
| `/admin/fees/payments` | A, C | রিসিট তালিকা | 6.6 |
| `/admin/fees/payments/[id]` | A, C | রিসিট দেখা, প্রিন্ট, VOID | 6.6, 6.7 |
| `/admin/fees/reports` | A, C | দৈনিক, তারিখ পরিসর, বকেয়া, কালেক্টর, জরিমানা রিপোর্ট | 6.8 |
| `/admin/expenses` | A, C | খরচ এন্ট্রি ও মাসিক আয়-ব্যয় | 6.9 |

Actions: `saveFeeType`, `saveFeeStructure`, `saveDiscount`, `toggleDiscount`, `generateInvoices(classIds, feeTypeId, period)`, `collectPayment(enrollmentId, amount, method, trxId)`, `voidPayment(id, reason)`, `waiveLateFee(invoiceId, amount, reason)`, `sendDueReminders(filter)`, `saveExpense`

### 5.8 পরীক্ষা ও রেজাল্ট — `server/actions/exams.ts`, `server/actions/results.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/exams` | A | পরীক্ষা তালিকা | 7.1 |
| `/admin/exams/new`, `/admin/exams/[id]` | A | পরীক্ষা, ক্লাস, বিষয়ভিত্তিক নম্বর বণ্টন, তারিখ | 7.1 |
| `/admin/exams/[id]/marks` | T, CT, A | সেকশন-বিষয় বেছে মার্কস এন্ট্রি; Excel টেমপ্লেট ও আপলোড | 7.2 |
| `/admin/exams/[id]/admit-cards` | A, O | অ্যাডমিট কার্ড ও সিট প্ল্যান | 7.6 |
| `/admin/results/config` | A | ক্লাসভিত্তিক পদ্ধতি: শুধু বার্ষিক / ওয়েটেড, ওয়েটেজ | 7.4 |
| `/admin/results` | A, CT | রেজাল্ট ব্যাচ তালিকা | 7.5 |
| `/admin/results/[batchId]` | A, CT | প্রসেস করা রেজাল্ট রিভিউ, প্রকাশ | 7.5 |
| `/admin/results/[batchId]/tabulation` | A, CT | ট্যাবুলেশন শিট | 7.6 |
| `/admin/results/[batchId]/merit` | A, CT | মেধাতালিকা ও অকৃতকার্য তালিকা | 7.6 |

Actions: `saveExam`, `saveExamSubjects`, `saveMarks(examSubjectId, sectionId, rows)`, `importMarksFromExcel(file)`, `setMarksLocked(examId, locked)`, `saveResultConfig`, `processResults(sessionId, classId, kind, examId?)`, `publishResults(batchId)` → SMS কিউতে

GPA হিসাব থাকবে `server/services/gpa.ts`-এ, শুদ্ধ (pure) ফাংশন হিসেবে, যাতে ইউনিট টেস্ট সহজ হয়।

### 5.9 নোটিশ ও SMS — `server/actions/notices.ts`, `server/actions/sms.ts`

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/notices` | A | নোটিশ তৈরি, প্রকাশ, লক্ষ্য দর্শক | 8.1 |
| `/admin/sms/send` | A | গ্রুপ বাছাই, টেমপ্লেট, প্রাপক সংখ্যা ও ক্রেডিট প্রিভিউ | 8.2 |
| `/admin/sms/logs` | A | SMS লগ ও স্ট্যাটাস | 8.2 |
| `/admin/sms/templates` | A | টেমপ্লেট এডিট | 8.2 |

Actions: `saveNotice`, `publishNotice`, `previewBulkSms(filter, templateKey)`, `sendBulkSms(filter, body)`, `saveSmsTemplate`, `retrySms(id)`

### 5.10 রিপোর্ট ও অডিট

| পেজ | রোল | কাজ | US |
| --- | --- | --- | --- |
| `/admin/reports` | A | সব রিপোর্টের এক জায়গা, Excel/PDF | 10.2 |
| `/admin/audit-logs` | A | কে কখন কী বদলালো | NFR |

---

## 6. পোর্টাল — `/portal` (STUDENT, GUARDIAN; মোবাইল-ফার্স্ট)

অভিভাবকের একাধিক সন্তান থাকলে "সক্রিয় সন্তান" কুকিতে থাকবে; প্রতিটি কোয়েরিতে যাচাই হবে যে সেই শিক্ষার্থী সত্যিই এই অভিভাবকের।

| পেজ | কে | কাজ | US |
| --- | --- | --- | --- |
| `/portal` | উভয় | সারাংশ: আজকের হাজিরা, বকেয়া, সর্বশেষ নোটিশ ও রেজাল্ট | 9.1, 9.2 |
| `/portal/switch` | অভিভাবক | সন্তান বদল | 1.2 |
| `/portal/profile` | উভয় | শিক্ষার্থীর প্রোফাইল (শুধু দেখা) | 9.1, 9.2 |
| `/portal/attendance` | উভয় | মাসিক হাজিরা ক্যালেন্ডার | 9.1, 9.2 |
| `/portal/routine` | উভয় | ক্লাস রুটিন | 9.2 |
| `/portal/results` | উভয় | প্রকাশিত রেজাল্ট তালিকা | 9.1, 9.2 |
| `/portal/results/[id]` | উভয় | মার্কশিট ও PDF ডাউনলোড | 9.1, 9.2 |
| `/portal/fees` | অভিভাবক (শিক্ষার্থী সেটিংস অনুযায়ী) | ইনভয়েস, বকেয়া, জরিমানা | 9.1 |
| `/portal/payments/[id]` | অভিভাবক | রিসিট ও PDF | 9.1 |
| `/portal/notices` | উভয় | নোটিশ | 9.1, 9.2 |

Actions: `switchChild(studentId)` — বাকি সব শুধু পড়া (Server Component)।

---

## 7. API Route Handlers — `/api`

| রুট | মেথড | কে কল করে | সুরক্ষা | কাজ |
| --- | --- | --- | --- | --- |
| `/api/files/upload` | POST | ব্রাউজার | লগইন + রোল | ছবি/সংযুক্তি আপলোড |
| `/api/files/[...key]` | GET | ব্রাউজার | লগইন + signed URL | ফাইল দেখা |
| `/api/pdf/receipt/[paymentId]` | GET | ব্রাউজার | লগইন + মালিকানা | রিসিট PDF |
| `/api/pdf/marksheet/[resultId]` | GET | ব্রাউজার | লগইন + মালিকানা | মার্কশিট PDF |
| `/api/pdf/id-cards` | GET | ব্রাউজার | A, O | আইডি কার্ড PDF |
| `/api/pdf/admit-cards/[examId]` | GET | ব্রাউজার | A, O | অ্যাডমিট কার্ড PDF |
| `/api/pdf/tabulation/[batchId]` | GET | ব্রাউজার | A, CT | ট্যাবুলেশন PDF |
| `/api/export/[report]` | GET | ব্রাউজার | রোল অনুযায়ী | Excel এক্সপোর্ট |
| `/api/templates/marks/[examSubjectId]` | GET | ব্রাউজার | T, CT, A | মার্কস এন্ট্রির Excel টেমপ্লেট |
| `/api/sms/webhook/[providerKey]` | POST | SMS প্রোভাইডার | প্রোভাইডারের সিক্রেট/সিগনেচার | ডেলিভারি রিপোর্ট |
| `/api/gateway/pull` | POST | Android গেটওয়ে | ডিভাইস টোকেন | পাঠানোর মতো SMS নেওয়া (রেট লিমিট মেনে) |
| `/api/gateway/report` | POST | Android গেটওয়ে | ডিভাইস টোকেন | পাঠানো/ব্যর্থ স্ট্যাটাস |
| `/api/gateway/heartbeat` | POST | Android গেটওয়ে | ডিভাইস টোকেন | `lastSeenAt` আপডেট |
| `/api/cron/monthly-invoices` | POST | Scheduler | `CRON_SECRET` | প্রতি মাসের ১ তারিখে ইনভয়েস |
| `/api/cron/late-fees` | POST | Scheduler | `CRON_SECRET` | প্রতিদিন জরিমানা হিসাব |
| `/api/cron/subscriptions` | POST | Scheduler | `CRON_SECRET` | মেয়াদ সতর্কতা, GRACE, SUSPENDED |
| `/api/cron/sms-queue` | POST | Scheduler | `CRON_SECRET` | প্রোভাইডার API ড্রাইভারের কিউ চালানো ও রিট্রাই |
| `/api/cron/gateway-health` | POST | Scheduler | `CRON_SECRET` | অফলাইন ডিভাইসের সতর্কতা |

---

## 8. অনুমতি (permissions.ts) — সারাংশ

| Permission | A | O | C | T | CT | STUDENT | GUARDIAN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| settings.manage | ✔ | | | | | | |
| academic.manage | ✔ | | | | | | |
| student.read | ✔ | ✔ | ✔ | নিজের ক্লাস | নিজের সেকশন | নিজে | নিজের সন্তান |
| student.write | ✔ | ✔ | | | | | |
| staff.manage | ✔ | | | | | | |
| attendance.take | ✔ | | | অ্যাসাইন করা সেকশন | নিজের সেকশন | | |
| attendance.editPast | ✔ | | | | | | |
| fee.setup | ✔ | | | | | | |
| fee.collect | ✔ | | ✔ | | | | |
| payment.void | ✔ | | | | | | |
| lateFee.waive | ✔ | | | | | | |
| marks.enter | ✔ | | | অ্যাসাইন করা বিষয় | অ্যাসাইন করা বিষয় | | |
| result.process | ✔ | | | | | | |
| result.review | ✔ | | | | নিজের সেকশন | | |
| result.publish | ✔ | | | | | | |
| notice.manage | ✔ | | | | | | |
| sms.send | ✔ | | | | | | |
| report.finance | ✔ | | ✔ | | | | |
| audit.read | ✔ | | | | | | |
| portal.fees | | | | | | সেটিংস অনুযায়ী | ✔ |
| super.manage | | | | | | | |
| user.manage | ✔ | | | | | | |
| certificate.print | ✔ | ✔ | | | | | |
| attendance.report | ✔ | | | | ✔ | | |
| exam.manage | ✔ | | | | | | |
| expense.manage | ✔ | | ✔ | | | | |
| portal.view | | | | | | ✔ | ✔ |

কোড: `src/server/auth/permissions.ts` (টেস্ট: `permissions.test.ts`)। `super.manage` শুধু SUPER_ADMIN-এর। SUPER_ADMIN স্কুলের ভেতরের ডেটায় সরাসরি হাত দেবে না; প্রয়োজনে "স্কুল হিসেবে দেখুন" (impersonate) পরে যোগ হবে, অডিট লগসহ।
