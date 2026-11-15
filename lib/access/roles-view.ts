// What the Roles screen is given (spec 0.7, 4.8 part 1, task 10a): pure types and
// the rules for what the viewer may change, free of server-only code so the
// screen's components can import them. Built on the server by lib/access/roles-read.ts;
// the server decides which rows and cells are editable, and checks again on every write.

import { canActOn, type Actor } from "./rank";
import { builtinRole, LOCKED_SWITCHES, withLockedSwitches, type BuiltinRoleKey } from "./roles";
import { cleanSwitches, SWITCHES, SWITCH_TEXT, summaryLines, type Switch } from "./switches";

/** One column per permission. `view` is held by every role, so it has none (spec 10a part 2). */
export const EDITABLE_SWITCHES: readonly Switch[] = SWITCHES.filter((s) => s !== "view");

export type RolePeople = { names: string[]; invitations: number };

export type RoleRow = {
  id: string;
  name: string;
  rank: number;
  builtin: BuiltinRoleKey | null;
  version: number;
  switches: Switch[];
  /** The rank rule lets the viewer change this role. */
  editable: boolean;
  /** Why a read-only row is read-only. */
  relation: "you" | "above" | null;
  /** Switches nobody can turn off here (the Store Manager's three). */
  locked: Switch[];
  /** Who holds it: names, and pending invitations. Only custom roles are filled in; built-ins can't be deleted. */
  people: RolePeople;
  /** The role a Move up / Move down would swap with, or null where the move is not offered. */
  upId: string | null;
  downId: string | null;
};

export type ActivityLine = { id: string; text: string; at: string };

export type RolesView = {
  roles: RoleRow[];
  /** The viewer's own permissions: a cell is enabled only for one they hold. */
  holds: Switch[];
  /** Moving people out of a deleted role needs `people.manage` as well. */
  canMovePeople: boolean;
  /** "Below <role>" choices for a new role: the viewer's own role and every role under it. */
  placements: { id: string; name: string }[];
  activity: ActivityLine[];
};

export type RoleInput = {
  id: string;
  name: string;
  rank: number;
  builtin: string | null;
  version: number;
  switches: unknown;
  people: RolePeople;
};

const BUILTIN_KEYS: readonly string[] = ["store_manager", "assistant_manager", "vm_manager", "vm_worker", "sales_associate"];
const builtinKey = (value: string | null): BuiltinRoleKey | null => (value !== null && BUILTIN_KEYS.includes(value) ? (value as BuiltinRoleKey) : null);

/** The roles in rank order with what the viewer may do to each. */
export function buildRoleRows(input: readonly RoleInput[], actor: Actor, viewerRoleId: string | null): RoleRow[] {
  const sorted = [...input].sort((a, b) => a.rank - b.rank);
  return sorted.map((r, i) => {
    const builtin = builtinKey(r.builtin);
    const editable = canActOn(actor, r.rank, "roles.manage");
    const above = sorted[i - 1];
    return {
      id: r.id,
      name: r.name,
      rank: r.rank,
      builtin,
      version: r.version,
      switches: [...cleanSwitches(r.switches)],
      editable,
      relation: editable ? null : r.id === viewerRoleId ? "you" : "above",
      locked: builtin === "store_manager" ? [...LOCKED_SWITCHES.store_manager] : [],
      people: r.people,
      // Only custom roles move; never up past the viewer's own role or anything above it.
      upId: editable && builtin === null && above && canActOn(actor, above.rank, "roles.manage") ? above.id : null,
      downId: editable && builtin === null && sorted[i + 1] ? sorted[i + 1].id : null,
    };
  });
}

/** Whether the viewer may flip one permission of one role: an editable row, not locked, and one the viewer holds. */
export function cellEnabled(row: RoleRow, s: Switch, holds: readonly Switch[]): boolean {
  return row.editable && !row.locked.includes(s) && holds.includes(s);
}

/** What a change to a role's permissions amounts to, in the summary's words. */
export function changeSummary(before: readonly Switch[], after: readonly Switch[]): { added: string[]; removed: string[]; now: string[] } {
  const was = new Set(before);
  const is = new Set(after);
  return {
    added: summaryLines(SWITCHES.filter((s) => is.has(s) && !was.has(s))),
    removed: summaryLines(SWITCHES.filter((s) => was.has(s) && !is.has(s))),
    now: summaryLines(after),
  };
}

/** "5 of 9 permissions", counting the nine that have a column. */
export function permissionCount(switches: readonly Switch[]): string {
  return `${switches.filter((s) => s !== "view").length} of ${EDITABLE_SWITCHES.length} permissions`;
}

export const labelOf = (s: Switch) => SWITCH_TEXT[s].label;

export type RoleAction = "rename" | "up" | "down" | "reset" | "delete";

/** Whether a built-in's name or permissions differ from what it shipped with, so Reset has something to do. */
export function differsFromDefault(row: RoleRow): boolean {
  if (row.builtin === null) return false;
  const base = builtinRole(row.builtin);
  const next = new Set(withLockedSwitches(base.switches, base.key));
  return row.name !== base.name || row.switches.length !== next.size || row.switches.some((s) => !next.has(s));
}

/** The ⋯ menu's items for a row, in order; one that can't apply is left out, not disabled (spec 10a part 4). */
export function roleActions(row: RoleRow): { key: RoleAction; label: string }[] {
  if (!row.editable) return [];
  const all: { key: RoleAction; label: string; on: boolean }[] = [
    { key: "rename", label: "Rename", on: true },
    { key: "up", label: "Move up", on: row.upId !== null },
    { key: "down", label: "Move down", on: row.downId !== null },
    { key: "reset", label: "Reset to default", on: differsFromDefault(row) },
    { key: "delete", label: "Delete", on: row.builtin === null },
  ];
  return all.filter((a) => a.on).map(({ key, label }) => ({ key, label }));
}
