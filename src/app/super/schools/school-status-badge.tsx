import type { SchoolStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

export function SchoolStatusBadge({ status, label }: { status: SchoolStatus; label: string }) {
  const variant = status === "ACTIVE" ? "secondary" : status === "SUSPENDED" ? "destructive" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
