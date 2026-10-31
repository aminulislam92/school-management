"use client";

import Link from "next/link";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/auth/actions";

export function UserMenu({
  name,
  roleLabels,
  signOutLabel,
  changePasswordLabel,
}: {
  name: string;
  roleLabels: string[];
  signOutLabel: string;
  changePasswordLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="gap-1 px-2" />}>
        <span className="max-w-36 truncate">{name}</span>
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block font-medium">{name}</span>
            <span className="block text-xs text-muted-foreground">{roleLabels.join(", ")}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/change-password" />}>
          <KeyRound className="size-4" />
          {changePasswordLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logoutAction()}>
          <LogOut className="size-4" />
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
