// The Store panel's "Roles and permissions" row (0.7.0.7 spec section 4): a 44 px link to the role
// editor at /store/roles. The panel shows it only to someone with `roles.manage`; the page checks again.

import { ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function RolesLink() {
  return (
    <Link
      href="/store/roles"
      className="mb-6 flex min-h-11 items-center gap-3 rounded-lg border border-line-subtle bg-raised px-4 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">Roles and permissions</span>
      <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-muted" />
    </Link>
  );
}
