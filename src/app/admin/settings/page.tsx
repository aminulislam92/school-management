import { redirect } from "next/navigation";

// The menu links to /admin/settings; the first tab is the school profile.
export default function SettingsIndex() {
  redirect("/admin/settings/school");
}
