import { redirect } from "next/navigation";

// The menu links to /admin/academic; the first tab is sessions.
export default function AcademicIndex() {
  redirect("/admin/academic/sessions");
}
