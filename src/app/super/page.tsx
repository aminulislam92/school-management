import { Suspense } from "react";
import { UserHome } from "@/components/user-home";

export default function Page() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={null}>
        <UserHome allowedRoles={["SUPER_ADMIN"]} area="super" />
      </Suspense>
    </main>
  );
}
