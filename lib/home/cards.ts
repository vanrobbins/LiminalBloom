// Which Home cards a viewer may see and which reads the loader must run for
// them (spec 0.7.0.6 sections 4 and 5.4). Pure, no server imports. Gating tests
// switches, never role names. A hidden card leaves no gap, and a viewer without
// a switch is never sent the data (the loader asks `readsFor` first).

import { can, type Holder } from "@/lib/access/can";
import type { Switch } from "@/lib/access/switches";

import type { CardKey, HomeData } from "./types";

/** One order for every role. */
export const CARD_ORDER: readonly CardKey[] = ["setup", "planograms", "invitations", "notPlaced", "published", "changes"];

/** Each card is allowed when the viewer holds any of these. */
const CARD_SWITCHES: Record<CardKey, readonly Switch[]> = {
  setup: ["layout.edit", "products.edit", "people.manage"],
  planograms: ["planograms.draft", "planograms.publish"],
  invitations: ["people.manage"],
  notPlaced: ["planograms.draft"],
  published: ["view"],
  changes: ["roles.manage"],
};

const holdsAny = (holder: Holder, switches: readonly Switch[]) => switches.some((s) => can(holder, s));

export function cardAllowed(holder: Holder, key: CardKey): boolean {
  return holdsAny(holder, CARD_SWITCHES[key]);
}

export type Reads = { planograms: boolean; summaries: boolean; invitations: boolean; activity: boolean; batch: boolean };

/** Which reads `loadHome` starts for this viewer. */
export function readsFor(holder: Holder): Reads {
  return {
    // Planogram work and the not-placed fixtures count; layout.edit also needs the layout for the setup step.
    planograms: holdsAny(holder, ["planograms.draft", "planograms.publish", "layout.edit"]),
    // The summaries (due dates, drafts) feed only cards 2 and 4; layout.edit alone needs just the layout.
    summaries: holdsAny(holder, ["planograms.draft", "planograms.publish"]),
    invitations: can(holder, "people.manage"),
    activity: can(holder, "roles.manage"),
    batch: true,
  };
}

function hasContent(key: CardKey, data: HomeData): boolean {
  switch (key) {
    case "setup":
      return (data.setup?.length ?? 0) > 0;
    case "planograms":
      return (data.planograms?.rows.length ?? 0) > 0;
    case "invitations":
      return (data.invitations?.length ?? 0) > 0;
    case "notPlaced":
      return (data.notPlaced?.products ?? 0) > 0 || (data.notPlaced?.fixtures ?? 0) > 0;
    case "published":
      return (data.published?.length ?? 0) > 0;
    case "changes":
      return (data.changes?.length ?? 0) > 0;
  }
}

/** Cards the viewer may see that have something to say, in order. */
export function shownCards(holder: Holder, data: HomeData): CardKey[] {
  return CARD_ORDER.filter((key) => cardAllowed(holder, key) && hasContent(key, data));
}
