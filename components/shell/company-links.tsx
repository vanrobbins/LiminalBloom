// The ways into /company from the shell (spec 0.7.1 6.1, 11), one small file so the menus stay short: the avatar
// menu's "Company" (the phone sheet's button and the dropdown's item) and the foot link "{Company}" beside "New
// store" in the store lists. Each shows only for a company person, who passes the company's name. Hiding is a
// courtesy: /company guards itself.

"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4 shrink-0" } as const;

/** The phone sheet's "Company" row. `close` runs when the link is followed. */
export function CompanySheetRow({ close }: { close: () => void }) {
  return (
    <Button asChild variant="secondary">
      <Link href="/company" onClick={close}>
        <Building2 {...ICON} />
        Company
      </Link>
    </Button>
  );
}

/** The dropdown's "Company" item. */
export function CompanyMenuItem() {
  return (
    <DropdownMenuItem asChild>
      <Link href="/company">
        <Building2 {...ICON} />
        Company
      </Link>
    </DropdownMenuItem>
  );
}

/** The foot of the phone's store list: the company's name, to /company. */
export function CompanyFootLink({ name, onFollow }: { name: string; onFollow?: () => void }) {
  return (
    <Button asChild variant="ghost">
      <Link href="/company" onClick={onFollow}>
        <Building2 {...ICON} />
        <span className="wrap-break-word">{name}</span>
      </Link>
    </Button>
  );
}

/** The foot of the dropdown's store list. */
export function CompanyFootItem({ name }: { name: string }) {
  return (
    <DropdownMenuItem asChild>
      <Link href="/company">
        <Building2 {...ICON} />
        <span className="min-w-0 wrap-break-word">{name}</span>
      </Link>
    </DropdownMenuItem>
  );
}
