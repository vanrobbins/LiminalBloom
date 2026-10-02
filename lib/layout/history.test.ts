import { describe, expect, it } from "vitest";

import { apply } from "./commands";
import { EMPTY_HISTORY, canRedo, canUndo, dropTouching, record, redo, undo } from "./history";
import { keyOf } from "./entities";
import { fixture, store } from "./test-layouts";

const noIds = () => "unused";

describe("undo and redo", () => {
  const before = { ...store(), fixtures: [fixture()] };
  const after = apply(before, { type: "move", ids: ["fixture-a"], delta: { x: 12, y: 0 } }, noIds);
  const history = record(EMPTY_HISTORY, before, after);

  it("undoes and redoes a move", () => {
    const undone = undo(history, after)!;
    expect(undone.layout.fixtures[0].x).toBe(300);
    expect(canRedo(undone.history)).toBe(true);
    const redone = redo(undone.history, undone.layout)!;
    expect(redone.layout.fixtures[0].x).toBe(312);
  });

  it("keeps the database version that is current now", () => {
    const saved = { ...after, fixtures: [{ ...after.fixtures[0], version: 9 }] };
    expect(undo(history, saved)!.layout.fixtures[0]).toMatchObject({ x: 300, version: 9 });
  });

  it("skips, rather than overwrites, an item changed since", () => {
    const changedElsewhere = { ...after, fixtures: [{ ...after.fixtures[0], name: "Renamed" }] };
    const step = undo(history, changedElsewhere)!;
    expect(step.skipped).toBe(true);
    expect(step.layout).toBe(changedElsewhere);
    expect(canUndo(step.history)).toBe(false);
  });

  it("records nothing for a change that changes nothing", () => {
    expect(record(EMPTY_HISTORY, before, before)).toBe(EMPTY_HISTORY);
  });

  it("forgets entries touching dropped items", () => {
    expect(canUndo(dropTouching(history, new Set([keyOf("fixtures", "fixture-a")])))).toBe(false);
  });
});
