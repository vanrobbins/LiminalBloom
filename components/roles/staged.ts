// The Roles screen's staged edits (spec 0.7, 4.8 part 3): permissions toggled but
// not saved yet, kept per role. A role whose staged set equals what is saved has no
// entry, so "anything staged" is simply "any entry".

import { blockerFor, nestingProblem, nestingText, type NestingProblem, type NestRole } from "@/lib/access/nesting";
import type { RoleRow } from "@/lib/access/roles-view";
import { SWITCHES, type Switch } from "@/lib/access/switches";

export type Staged = Record<string, Switch[]>;

export const switchesOf = (row: RoleRow, staged: Staged): Switch[] => staged[row.id] ?? row.switches;

/** Flips one permission of one role in the staged edits. */
export function toggled(staged: Staged, row: RoleRow, s: Switch): Staged {
  const now = new Set(switchesOf(row, staged));
  if (now.has(s)) now.delete(s);
  else now.add(s);
  const next = SWITCHES.filter((x) => now.has(x));
  const rest = Object.fromEntries(Object.entries(staged).filter(([id]) => id !== row.id));
  const same = next.length === row.switches.length && next.every((x, i) => x === row.switches[i]);
  return same ? rest : { ...rest, [row.id]: next };
}

export const changedRows = (rows: readonly RoleRow[], staged: Staged) => rows.filter((r) => staged[r.id] !== undefined);

/** The roles as they would stand if the staged edits were saved; `was` marks what each edit changes. */
export function stagedRoles(rows: readonly RoleRow[], staged: Staged): NestRole[] {
  return rows.map((r) => ({ id: r.id, name: r.name, rank: r.rank, switches: switchesOf(r, staged), was: r.switches }));
}

/** What is wrong with the whole staged state, or null: the screen shows it and holds back Review and save. */
export const stagedProblem = (rows: readonly RoleRow[], staged: Staged): NestingProblem | null => nestingProblem(stagedRoles(rows, staged));

/**
 * What flipping this cell would run into in the staged state, in words, or null.
 * The cell stays usable (the other roles may be fixed in any order); the note is
 * its title and its description, and the screen holds back saving while any remains.
 */
export function cellNote(rows: readonly RoleRow[], staged: Staged, row: RoleRow, s: Switch): string | null {
  const turningOn = !switchesOf(row, staged).includes(s);
  const other = blockerFor(stagedRoles(rows, staged), row.id, s, turningOn);
  return other ? nestingText({ role: { id: row.id, name: row.name }, other, switch: s, direction: turningOn ? "on" : "off" }) : null;
}
