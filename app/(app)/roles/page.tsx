// Roles and permissions (spec 0.7, 4.8 part 1): what each role can do, edited in
// one staged batch. Needs `roles.manage`; anyone else goes to /no-access. Reached
// from People ("Roles and permissions"); there is no nav entry.

import { RolesScreen } from "@/components/roles/roles-screen";
import { rolesViewFor } from "@/lib/access/roles-read";
import { requireSwitch } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const member = await requireSwitch("roles.manage");
  const view = await rolesViewFor(member);
  return <RolesScreen view={view} />;
}
