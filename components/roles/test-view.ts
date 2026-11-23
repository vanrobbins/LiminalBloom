// Builders for the Roles screen's tests: the view a viewer of a given role would be sent.

import { BUILTIN_ROLES } from "@/lib/access/roles";
import { buildRoleRows, type RoleInput, type RolesView } from "@/lib/access/roles-view";
import { SWITCHES, type Switch } from "@/lib/access/switches";

export const builtinInputs = (): RoleInput[] =>
  BUILTIN_ROLES.map((r) => ({ id: r.key, name: r.name, rank: r.rank, builtin: r.key, version: 1, switches: [...r.switches], requiresTwoFactor: false, people: { names: [], invitations: 0 } }));

export const customRole = (id: string, rank: number, switches: Switch[], people = { names: [] as string[], invitations: 0 }): RoleInput => ({ id, name: id, rank, builtin: null, version: 1, switches, requiresTwoFactor: false, people });

/** The view for someone who holds `holds` at `rank`, in the role `roleId`. */
export function viewFor(rank: number, roleId: string, holds: readonly Switch[], more: RoleInput[] = [], extra: Partial<RolesView> = {}): RolesView {
  const input = [...builtinInputs(), ...more];
  const roles = buildRoleRows(input, { rank, switches: new Set(holds) }, roleId);
  return {
    roles,
    holds: [...holds],
    canMovePeople: holds.includes("people.manage"),
    placements: roles.filter((r) => r.rank >= rank).map((r) => ({ id: r.id, name: r.name })),
    activity: [],
    ...extra,
  };
}

export const heldBy = (key: string): Switch[] => [...(BUILTIN_ROLES.find((r) => r.key === key)?.switches ?? SWITCHES)];
export const storeManagerView = (more: RoleInput[] = [], extra: Partial<RolesView> = {}) => viewFor(100, "store_manager", [...SWITCHES], more, extra);
export const assistantManagerView = (more: RoleInput[] = []) => viewFor(200, "assistant_manager", heldBy("assistant_manager"), more);
