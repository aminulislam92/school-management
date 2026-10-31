import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantHost, TENANT_KIND_HEADER, TENANT_VALUE_HEADER } from "@/lib/tenant-host";

// Runs before every request: works out the school from the Host header and
// passes it to the app in request headers. Those headers are always
// overwritten here, so a browser can never fake them.

// Paths that only exist on one side.
const ROOT_ONLY = ["/super"];
const SCHOOL_ONLY = ["/admin", "/portal"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const tenant = resolveTenantHost(
    request.headers.get("host"),
    process.env.ROOT_DOMAIN ?? "localhost",
  );
  const path = request.nextUrl.pathname;

  // A school site has no super-admin panel, and the main site has no school panel.
  const isRoot = tenant.kind === "root";
  if ((isRoot && startsWithAny(path, SCHOOL_ONLY)) || (!isRoot && startsWithAny(path, ROOT_ONLY))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers(request.headers);
  headers.set(TENANT_KIND_HEADER, tenant.kind);
  if (tenant.kind === "subdomain") headers.set(TENANT_VALUE_HEADER, tenant.code);
  else if (tenant.kind === "custom") headers.set(TENANT_VALUE_HEADER, tenant.domain);
  else headers.delete(TENANT_VALUE_HEADER);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
