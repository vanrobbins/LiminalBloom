// The shapes Home passes from its loader to its cards (spec 0.7.0.6 section 5.1).
// Pure and client-safe: components import it. Each card has one optional field;
// the loader fills only the cards the viewer's switches allow.

import type { ListItem } from "@/lib/planograms/list";

export type CardKey = "setup" | "planograms" | "invitations" | "notPlaced" | "published" | "changes";

/** One missing step on card 1. */
export type SetupRow = { key: "layout" | "product" | "team"; label: string; href: string };

/** A planogram on card 2. `overdue` is a due date before the store's today. */
export type PlanogramWorkRow = ListItem & { overdue: boolean };
export type PlanogramWork = { rows: PlanogramWorkRow[]; total: number };

/** A pending invitation on card 3. `state` carries the People card's words: Expires / Expired / Lapsed. */
export type InvitationRow = { id: string; email: string; roleName: string; state: "pending" | "expired" | "lapsed"; expiresAt: Date };

/** Card 4: counts of what has no place or no planogram yet. */
export type NotPlaced = { products: number; fixtures: number };

/** A publish on card 5. */
export type PublishRow = { fixtureId: string; fixtureName: string; version: number; publisherName: string; publishedAt: Date };

/** An access event on card 6, already worded by `activityText`. */
export type ChangeRow = { id: string; text: string; at: Date };

export type HomeData = {
  setup?: SetupRow[];
  planograms?: PlanogramWork;
  invitations?: InvitationRow[];
  notPlaced?: NotPlaced;
  published?: PublishRow[];
  changes?: ChangeRow[];
};
