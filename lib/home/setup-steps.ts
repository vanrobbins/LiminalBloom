// Card 1, "Set up the store" (spec 0.7.0.6 section 4): the steps still missing,
// each only for a viewer who can do it. The loader gathers the facts.

import { can, type Holder } from "@/lib/access/can";

import type { SetupRow } from "./types";

export type SetupFacts = {
  /** The store has a drawn outline (`layout.outline !== null`). */
  hasOutline: boolean;
  productCount: number;
  memberCount: number;
  /** Invitations still open (state "pending"); expired and lapsed ones do not count. */
  pendingInvitations: number;
};

export function setupSteps(facts: SetupFacts, holder: Holder): SetupRow[] {
  const rows: SetupRow[] = [];
  if (!facts.hasOutline && can(holder, "layout.edit")) rows.push({ key: "layout", label: "Draw the store layout", href: "/layout/edit" });
  if (facts.productCount === 0 && can(holder, "products.edit")) rows.push({ key: "product", label: "Add the first product", href: "/products/new" });
  if (facts.memberCount <= 1 && facts.pendingInvitations === 0 && can(holder, "people.manage")) rows.push({ key: "team", label: "Invite your team", href: "/store" });
  return rows;
}
