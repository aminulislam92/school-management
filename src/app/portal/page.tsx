import { Suspense } from "react";
import { PORTAL_ROLES } from "@/server/auth/permissions";
import { UserHome } from "@/components/user-home";

export default function Page() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={null}>
        <UserHome allowedRoles={[...PORTAL_ROLES]} area="portal" />
      </Suspense>
    </main>
  );
}
