// Signed-in pages share the app shell. This layout only draws it: each page
// still calls requireMember() itself, because a layout is not re-run when
// someone moves between pages (lib/current-member.ts).

import { AppShell } from "@/components/shell/app-shell";
import { getCurrentMember } from "@/lib/current-member";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();

  // Not a member yet: the page is about to redirect. Never draw a shell with
  // no one in it.
  if (member.kind !== "member") {
    return children;
  }

  return <AppShell member={member}>{children}</AppShell>;
}
