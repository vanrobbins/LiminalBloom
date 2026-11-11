// The five built-in store roles and what each holds by default (spec 0.7, 4.2),
// plus the locks no editor can undo. Rank is a whole number and a smaller
// number is a higher rank; built-ins are spaced by 100 so custom roles fit
// between them.

import { SWITCHES, type Switch } from "./switches";

export type BuiltinRoleKey = "store_manager" | "assistant_manager" | "vm_manager" | "vm_worker" | "sales_associate";

export type BuiltinRole = {
  key: BuiltinRoleKey;
  name: string;
  rank: number;
  /** In list order. */
  switches: readonly Switch[];
};

// Everything the Store Manager can do. The three locked ones are in it too.
const ALL: readonly Switch[] = Object.freeze([...SWITCHES]);

const EDITOR_BASE: readonly Switch[] = Object.freeze([
  "view",
  "products.stock",
  "products.sale",
  "planograms.draft",
  "planograms.publish",
  "layout.edit",
  "products.edit",
]);

const role = (r: BuiltinRole): BuiltinRole => Object.freeze({ ...r, switches: Object.freeze([...r.switches]) });

/** Top rank first. */
export const BUILTIN_ROLES: readonly BuiltinRole[] = Object.freeze([
  role({ key: "store_manager", name: "Store Manager", rank: 100, switches: ALL }),
  role({ key: "assistant_manager", name: "Assistant Manager", rank: 200, switches: [...EDITOR_BASE, "people.manage", "roles.manage"] }),
  role({ key: "vm_manager", name: "Visual Merchandising Manager", rank: 300, switches: [...EDITOR_BASE, "people.manage"] }),
  role({ key: "vm_worker", name: "Visual Merchandising Worker", rank: 400, switches: ["view", "products.stock", "products.sale", "planograms.draft"] }),
  role({ key: "sales_associate", name: "Sales Associate", rank: 500, switches: ["view", "products.stock"] }),
]);

/** The defaults "reset to default" restores. */
export function builtinRole(key: BuiltinRoleKey): BuiltinRole {
  const role = BUILTIN_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown built-in role: ${key}`);
  return role;
}

/**
 * Held whatever an editor proposes. A store always keeps someone who can manage
 * people, roles and settings, so the Store Manager cannot be edited out of them.
 * (`view` is locked for every role and is added by `withLockedSwitches`.)
 */
export const LOCKED_SWITCHES: Readonly<Record<"store_manager", readonly Switch[]>> = Object.freeze({
  store_manager: Object.freeze(["people.manage", "roles.manage", "store.settings"] as Switch[]),
});

/**
 * A proposed switch set with the locks applied, in list order. Pass the role's
 * built-in key, or null for a custom role. Every save goes through this so no
 * caller can store a role without `view`, or a Store Manager without its three.
 */
export function withLockedSwitches(proposed: Iterable<Switch>, builtinKey: BuiltinRoleKey | null): Set<Switch> {
  const out = new Set<Switch>(proposed);
  out.add("view");
  if (builtinKey === "store_manager") for (const s of LOCKED_SWITCHES.store_manager) out.add(s);
  return new Set(SWITCHES.filter((s) => out.has(s)));
}
