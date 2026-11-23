// The rank rule and its neighbours (spec 0.7, 4.2 and 4.3). A smaller rank
// number is a higher rank. The company-level exception (owners and corporate
// admins acting on any role) needs no code here: their ranks 10 and 20 are above
// every store role and they hold every store switch. `canActOnCompany` is the
// same rule over company switches.

import type { ProductStatus } from "@/lib/product-status";

import type { CompanySwitch } from "./company-switches";
import type { Switch } from "./switches";

export type Actor = { rank: number; switches: ReadonlySet<Switch> };

/**
 * Whether the actor may invite, assign, change, remove or edit something at
 * `targetRank`. Strictly lower only: equal rank is refused, so two Store
 * Managers cannot act on each other. `needs` is the switch for the kind of
 * action: people or roles.
 */
export function canActOn(actor: Actor, targetRank: number, needs: "people.manage" | "roles.manage"): boolean {
  if (!Number.isSafeInteger(actor.rank) || !Number.isSafeInteger(targetRank)) return false;
  return actor.switches.has(needs) && actor.rank < targetRank;
}

export type CompanyActor = { rank: number; switches: ReadonlySet<CompanySwitch> };

/**
 * The same rule over company switches (0.7.1, spec 2.3): the switch and a
 * strictly lower rank, so an owner (10) acts on corporate admins (20) and
 * regional managers (30), a corporate admin only on regional managers.
 */
export function canActOnCompany(actor: CompanyActor, targetRank: number, needs: CompanySwitch): boolean {
  if (!Number.isSafeInteger(actor.rank) || !Number.isSafeInteger(targetRank)) return false;
  return actor.switches.has(needs) && actor.rank < targetRank;
}

/** Nobody gives a role a permission they lack themselves. */
export function canGrant(actor: Actor, switches: Iterable<Switch>): boolean {
  for (const s of switches) if (!actor.switches.has(s)) return false;
  return true;
}

export type StatusChangeNeed = "products.stock" | "products.sale" | "unchanged";

// Written as a full table so a status added to the database enum is a compile
// error here until someone decides what its changes need.
const STATUS_NEEDS: Record<ProductStatus, Record<ProductStatus, StatusChangeNeed>> = {
  in_stock: { in_stock: "unchanged", sold_out: "products.stock", on_sale: "products.sale" },
  sold_out: { in_stock: "products.stock", sold_out: "unchanged", on_sale: "products.sale" },
  on_sale: { in_stock: "products.sale", sold_out: "products.stock", on_sale: "unchanged" },
};

const STATUS_ORDER: readonly ProductStatus[] = ["in_stock", "sold_out", "on_sale"];

/**
 * Which switch a status change needs. Anything to sold out, and sold out back
 * to in stock, is stock; anything that starts or ends a sale (apart from
 * on sale to sold out) is sale. "unchanged" means there is no change to check.
 */
export function statusChangeNeeds(from: ProductStatus, to: ProductStatus): StatusChangeNeed {
  return STATUS_NEEDS[from][to];
}

/**
 * The statuses a person may change this product to, in the usual order. It
 * leaves out the current status: the control shows that as the current value
 * and offers only changes.
 */
export function allowedStatuses(current: ProductStatus, switches: ReadonlySet<Switch>): ProductStatus[] {
  return STATUS_ORDER.filter((to) => {
    const needs = statusChangeNeeds(current, to);
    return needs !== "unchanged" && switches.has(needs);
  });
}

/** The gap between neighbouring ranks when ranks are handed out fresh. */
export const RANK_STEP = 100;

/**
 * A whole-number rank strictly between `above` (the role just over it, the
 * smaller number) and `below` (the role just under it). With no role below, a
 * full step past `above`. Returns null when there is no whole number in the
 * gap; the caller then renumbers (`renumberRanks`) and asks again. The middle
 * is taken so the room left on each side is as even as it can be. Returns null
 * too when either bound is not a whole, finite number.
 *
 * Caller obligations:
 * (a) Still check `canActOn(actor, result, "roles.manage")` before saving: a
 *     rank between two roles can be above the actor's own.
 * (b) `above` and `below` must be neighbouring roles; otherwise the result
 *     can collide with an existing rank (the database's unique constraint
 *     refuses it).
 */
export function rankBetween(above: number, below: number | null): number | null {
  if (!Number.isSafeInteger(above) || (below !== null && !Number.isSafeInteger(below))) return null;
  if (below === null) return above + RANK_STEP;
  const middle = Math.floor((above + below) / 2);
  return middle > above && middle < below ? middle : null;
}

/**
 * Fresh ranks for a list already in order, top role first: 100, 200, 300, and
 * so on, every `RANK_STEP`, the same spacing the built-ins start with. Order is
 * never changed, so built-in roles keep their order among themselves, though a
 * custom role placed above one pushes its rank past its default. The first
 * role gets 100, so a Store Manager (always first, always 100) never moves.
 * Company roles (0.7.1) sit above all of this, at 10, 20, 30. Returns copies;
 * the input is not touched.
 *
 * Caller rules:
 * - Order never changes, so who outranks whom is unchanged.
 * - The write must be one statement, or run under a deferrable unique
 *   constraint, because ranks pass through duplicates.
 * - Renumbering is a system step that follows an already-authorised change;
 *   it is not itself checked with `canActOn`.
 *
 * Throws if the list is non-empty and its first item is not the lowest rank in
 * it: callers must pass the roles in rank order, top first.
 */
export function renumberRanks<T extends { rank: number }>(ordered: readonly T[]): T[] {
  if (ordered.length > 0 && ordered.some((r) => r.rank < ordered[0].rank)) {
    throw new Error("renumberRanks: pass the roles in rank order, top first (the first item must hold the lowest rank)");
  }
  return ordered.map((role, i) => ({ ...role, rank: RANK_STEP * (i + 1) }));
}
