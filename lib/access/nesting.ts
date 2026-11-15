// Permissions nest (Van, 11-11): every role's switches stay within every higher
// role's, a smaller rank number being higher. A role can never do what a role
// above it cannot. Pure, so the screen can explain a blocked change and the
// write can check the whole saved batch with the same rule.

import { SWITCHES, type Switch } from "./switches";

export type NestRole = {
  id: string;
  name: string;
  rank: number;
  /** After the change. */
  switches: Iterable<Switch>;
  /**
   * The switches the role held before the change. Leave it out for a role whose
   * every switch counts as changed (a new role, or one whose place moved): then
   * any pair it is in is checked in full. A role passed with `was` equal to
   * `switches` is untouched, so a mismatch that already existed between two
   * untouched roles is not blamed on this change.
   */
  was?: Iterable<Switch>;
};

export type NestingProblem = {
  /** The role this change gave `switch` to ("on") or took it from ("off"). */
  role: { id: string; name: string };
  /** The role that blocks it: it lacks the switch above `role` ("on"), or still holds it below `role` ("off"). */
  other: { id: string; name: string };
  switch: Switch;
  direction: "on" | "off";
};

const ref = ({ id, name }: NestRole) => ({ id, name });

/**
 * The first place the roles do not nest that this change is responsible for,
 * or null. Without `was` on any role every mismatch counts. Pairs are ordered
 * from the lowest-ranked role up, the switch list order within a pair.
 */
export function nestingProblem(roles: readonly NestRole[]): NestingProblem | null {
  const sorted = [...roles].sort((a, b) => b.rank - a.rank);
  const held = new Map(sorted.map((r) => [r.id, new Set(r.switches)]));
  const was = new Map(sorted.map((r) => [r.id, r.was === undefined ? null : new Set(r.was)]));
  for (let lo = 0; lo < sorted.length; lo++) {
    for (let hi = lo + 1; hi < sorted.length; hi++) {
      const low = sorted[lo];
      const high = sorted[hi];
      if (high.rank === low.rank) continue;
      for (const s of SWITCHES) {
        if (!held.get(low.id)!.has(s) || held.get(high.id)!.has(s)) continue;
        const gained = was.get(low.id) === null || !was.get(low.id)!.has(s);
        const lost = was.get(high.id) === null || was.get(high.id)!.has(s);
        if (gained) return { role: ref(low), other: ref(high), switch: s, direction: "on" };
        if (lost) return { role: ref(high), other: ref(low), switch: s, direction: "off" };
      }
    }
  }
  return null;
}

/**
 * Why `role` can't have `switch` turned `on` (or off) in this state, or null.
 * Turning on needs every higher role to hold it: the blocker is the highest
 * one that doesn't, which must be fixed first. Turning off needs every lower
 * role to lack it: the blocker is the lowest one that holds it.
 */
export function blockerFor(roles: readonly NestRole[], roleId: string, s: Switch, turningOn: boolean): { id: string; name: string } | null {
  const me = roles.find((r) => r.id === roleId);
  if (!me) return null;
  const has = (r: NestRole) => new Set(r.switches).has(s);
  const sorted = [...roles].sort((a, b) => a.rank - b.rank);
  if (turningOn) {
    const lacking = sorted.find((r) => r.rank < me.rank && !has(r));
    return lacking ? ref(lacking) : null;
  }
  const holding = [...sorted].reverse().find((r) => r.rank > me.rank && has(r));
  return holding ? ref(holding) : null;
}

// What each permission reads as after "can't". A Record, so a new switch is a compile error here.
const CAN_PHRASE: Record<Switch, string> = {
  view: "view the store",
  "products.stock": "mark products sold out",
  "products.sale": "run sales",
  "planograms.draft": "draft planograms",
  "planograms.publish": "publish planograms",
  "layout.edit": "edit the map",
  "products.edit": "edit products",
  "people.manage": "manage people",
  "roles.manage": "manage roles",
  "store.settings": "change store settings",
};

/**
 * The plain-words reason, naming the role that blocks the change. `isNew` is for
 * a role being added: it has nothing to "turn off", so the same finding reads
 * as what it must hold to sit above the role below.
 */
export function nestingText(problem: NestingProblem, isNew = false): string {
  const phrase = CAN_PHRASE[problem.switch];
  if (problem.direction === "on") return `${problem.other.name} can't ${phrase}, so ${problem.role.name} can't either.`;
  return isNew ? `${problem.other.name} can ${phrase}, so ${problem.role.name} must be able to as well, placed above it.` : `${problem.other.name} can still ${phrase}; turn it off there first.`;
}
