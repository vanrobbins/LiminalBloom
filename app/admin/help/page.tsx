// /admin/help (spec 0.7.1 7.3, 9.2): the help queue. Open oldest first, then Replied and Closed; each row opens its thread.

import { HelpQueue } from "@/components/admin/help-queue";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { adminHelpList } from "@/lib/admin/help-reads";

export const dynamic = "force-dynamic";

export default async function AdminHelpPage() {
  await requirePlatformAdmin();
  const { open, replied, closed } = await adminHelpList();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Help</h1>
      <HelpQueue open={open} replied={replied} closed={closed} />
    </>
  );
}
