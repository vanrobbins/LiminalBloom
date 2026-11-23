// /admin/requests (spec 0.7.1 7.3): company requests, waiting ones first. Each row opens the request.

import { RequestList } from "@/components/admin/request-list";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { adminRequestList } from "@/lib/admin/request-reads";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requirePlatformAdmin();
  const { pending, decided } = await adminRequestList();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Company requests</h1>
      <RequestList pending={pending} decided={decided} />
    </>
  );
}
