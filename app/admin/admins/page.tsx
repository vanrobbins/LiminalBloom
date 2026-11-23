// /admin/admins (spec 0.7.1 7.1): Liminal Bloom's admins, Add by email and Remove. The last admin stays.

import { AddAdmin } from "@/components/admin/admin-people-actions";
import { AdminList } from "@/components/admin/admin-list";
import { listAdmins } from "@/lib/admin/admins";
import { requirePlatformAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const me = await requirePlatformAdmin();
  const admins = await listAdmins();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">Admins</h1>
      <AddAdmin />
      <section aria-labelledby="current-admins" className="flex flex-col gap-2">
        <h2 id="current-admins" className="text-lg font-semibold text-ink">Current admins</h2>
        <AdminList admins={admins} currentUserId={me.userId} />
      </section>
    </>
  );
}
