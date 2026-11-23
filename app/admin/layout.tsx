// The frame of every /admin page. It is NOT a guard: a layout is not re-run when someone moves between pages
// (lib/current-member.ts), so every page calls its own guard from lib/admin/guard.ts. This only decides whether
// to draw the admin shell, and it never redirects: the two-factor setup and step-up pages must stay reachable
// for an admin who has no fresh factor, and a non-admin's 404 must carry no admin chrome. Those get the bare page.

import { AdminShell } from "@/components/admin/admin-shell";
import { adminShellAccount } from "@/lib/admin/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await adminShellAccount();
  if (!account) return children;
  return <AdminShell account={{ name: account.name, email: account.email }}>{children}</AdminShell>;
}
