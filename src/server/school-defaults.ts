// Default master data every new school starts with.
// Used by createSchool() (src/server/super/schools.ts) and prisma/seed.ts.
import type { FeeFrequency, Level } from "@prisma/client";

export const DEFAULT_CLASSES: {
  order: number;
  nameBn: string;
  nameEn: string;
  level: Level;
  hasGroups: boolean;
}[] = [
  { order: 1, nameBn: "প্লে", nameEn: "Play", level: "PRE_PRIMARY", hasGroups: false },
  { order: 2, nameBn: "নার্সারি", nameEn: "Nursery", level: "PRE_PRIMARY", hasGroups: false },
  { order: 3, nameBn: "কেজি", nameEn: "KG", level: "PRE_PRIMARY", hasGroups: false },
  { order: 4, nameBn: "প্রথম শ্রেণি", nameEn: "Class One", level: "PRIMARY", hasGroups: false },
  { order: 5, nameBn: "দ্বিতীয় শ্রেণি", nameEn: "Class Two", level: "PRIMARY", hasGroups: false },
  { order: 6, nameBn: "তৃতীয় শ্রেণি", nameEn: "Class Three", level: "PRIMARY", hasGroups: false },
  { order: 7, nameBn: "চতুর্থ শ্রেণি", nameEn: "Class Four", level: "PRIMARY", hasGroups: false },
  { order: 8, nameBn: "পঞ্চম শ্রেণি", nameEn: "Class Five", level: "PRIMARY", hasGroups: false },
  { order: 9, nameBn: "ষষ্ঠ শ্রেণি", nameEn: "Class Six", level: "SECONDARY", hasGroups: false },
  { order: 10, nameBn: "সপ্তম শ্রেণি", nameEn: "Class Seven", level: "SECONDARY", hasGroups: false },
  { order: 11, nameBn: "অষ্টম শ্রেণি", nameEn: "Class Eight", level: "SECONDARY", hasGroups: false },
  { order: 12, nameBn: "নবম শ্রেণি", nameEn: "Class Nine", level: "SECONDARY", hasGroups: true },
  { order: 13, nameBn: "দশম শ্রেণি", nameEn: "Class Ten", level: "SECONDARY", hasGroups: true },
  { order: 14, nameBn: "একাদশ শ্রেণি", nameEn: "Class Eleven", level: "HIGHER_SECONDARY", hasGroups: true },
  { order: 15, nameBn: "দ্বাদশ শ্রেণি", nameEn: "Class Twelve", level: "HIGHER_SECONDARY", hasGroups: true },
];

export const DEFAULT_GROUPS = [
  { nameBn: "বিজ্ঞান", nameEn: "Science" },
  { nameBn: "ব্যবসায় শিক্ষা", nameEn: "Business Studies" },
  { nameBn: "মানবিক", nameEn: "Humanities" },
];

// Bangladesh SSC/HSC scale (5.00). Percent bands are inclusive.
export const BD_GRADE_SCALE = {
  name: "Bangladesh 5.00",
  items: [
    { minPercent: "80", maxPercent: "100", letter: "A+", point: "5.00", isFail: false },
    { minPercent: "70", maxPercent: "79.99", letter: "A", point: "4.00", isFail: false },
    { minPercent: "60", maxPercent: "69.99", letter: "A-", point: "3.50", isFail: false },
    { minPercent: "50", maxPercent: "59.99", letter: "B", point: "3.00", isFail: false },
    { minPercent: "40", maxPercent: "49.99", letter: "C", point: "2.00", isFail: false },
    { minPercent: "33", maxPercent: "39.99", letter: "D", point: "1.00", isFail: false },
    { minPercent: "0", maxPercent: "32.99", letter: "F", point: "0.00", isFail: true },
  ],
};

export const DEFAULT_FEE_TYPES: { nameBn: string; nameEn: string; frequency: FeeFrequency }[] = [
  { nameBn: "ভর্তি ফি", nameEn: "Admission Fee", frequency: "ONE_TIME" },
  { nameBn: "সেশন ফি", nameEn: "Session Fee", frequency: "ONE_TIME" },
  { nameBn: "মাসিক বেতন", nameEn: "Monthly Tuition", frequency: "MONTHLY" },
  { nameBn: "পরীক্ষা ফি", nameEn: "Exam Fee", frequency: "EXAM" },
];

export const DEFAULT_SMS_TEMPLATES = [
  {
    key: "ABSENT",
    bodyBn: "প্রিয় অভিভাবক, আজ {date} তারিখে {student_name} ({class}) অনুপস্থিত। - {school_name}",
    bodyEn: "Dear guardian, {student_name} ({class}) is absent today, {date}. - {school_name}",
  },
  {
    key: "RECEIPT",
    bodyBn: "{student_name}-এর {amount} টাকা গৃহীত হয়েছে। রসিদ নং {receipt_no}। - {school_name}",
    bodyEn: "Received Tk {amount} for {student_name}. Receipt {receipt_no}. - {school_name}",
  },
  {
    key: "DUE_REMINDER",
    bodyBn: "{student_name}-এর বকেয়া {amount} টাকা। অনুগ্রহ করে পরিশোধ করুন। - {school_name}",
    bodyEn: "{student_name} has Tk {amount} due. Please pay soon. - {school_name}",
  },
  {
    key: "RESULT",
    bodyBn: "{exam_name}: {student_name} GPA {gpa}, মেধাক্রম {position}। - {school_name}",
    bodyEn: "{exam_name}: {student_name} GPA {gpa}, position {position}. - {school_name}",
  },
  {
    key: "OTP",
    bodyBn: "আপনার লগইন কোড {code}। ৫ মিনিট বৈধ। কাউকে জানাবেন না।",
    bodyEn: "Your login code is {code}. Valid for 5 minutes. Do not share it.",
  },
];

/** Shown in the "board" dropdown when creating a school. */
export const EDUCATION_BOARDS = [
  "Dhaka",
  "Rajshahi",
  "Cumilla",
  "Jashore",
  "Chattogram",
  "Barishal",
  "Sylhet",
  "Dinajpur",
  "Mymensingh",
  "Madrasah",
  "Technical",
] as const;
