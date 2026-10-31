// Business rule: may a student log in to the portal?
// The school sets "students can log in from class X" (SchoolSetting.studentLoginFromOrder,
// using SchoolClass.order: Play=1 … Class Six=9 … Twelve=15). null = student login is off.

export function studentLoginAllowed(fromOrder: number | null, classOrder: number | null): boolean {
  if (fromOrder === null) return false; // switched off for the whole school
  if (classOrder === null) return false; // not enrolled in the current session
  return classOrder >= fromOrder;
}
