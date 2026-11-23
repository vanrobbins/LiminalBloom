// Card 2 and half of card 4 (spec 0.7.0.6 section 4). Works on `planogramList`'s
// groups, so lowers and non-anchor run racks are already left out. Due dates are
// plain dates compared as ISO strings; overdue is a date before store-today, the
// same rule as /planograms (`dueLabel`), so a date equal to today is due, not overdue.

import { compareNames } from "@/lib/natural-sort";
import { dueLabel } from "@/lib/planograms/dates";
import type { ListGroup } from "@/lib/planograms/list";

import type { PlanogramWork, PlanogramWorkRow } from "./types";

/** Overdue (oldest first), then due (soonest first), then undated drafts by name. */
function compareWork(a: PlanogramWorkRow, b: PlanogramWorkRow): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueDate !== null && b.dueDate !== null && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if ((a.dueDate === null) !== (b.dueDate === null)) return a.dueDate === null ? 1 : -1;
  return compareNames(a.name, b.name);
}

/** Planograms with a due date, a draft or a Quick Adjust draft (0.7.0.9), in order; `rows` is capped at `limit`, `total` is not. */
export function planogramWork(groups: readonly ListGroup[], today: string, limit = 5): PlanogramWork {
  const work = groups
    .flatMap((g) => g.items)
    .filter((i) => i.dueDate !== null || i.hasDraft || i.adjustment === "draft")
    .map((i): PlanogramWorkRow => ({ ...i, overdue: i.dueDate !== null && dueLabel(i.dueDate, today).overdue }))
    .sort(compareWork);
  return { rows: work.slice(0, limit), total: work.length, today };
}

/** Fixtures that show product and have neither a published version nor a draft. */
export function fixturesWithoutPlanogram(groups: readonly ListGroup[]): number {
  return groups.flatMap((g) => g.items).filter((i) => i.publishedVersion === null && !i.hasDraft).length;
}
