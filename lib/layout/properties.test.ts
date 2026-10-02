// Rules that must hold for any input, checked against generated cases (100 per
// property by default; spec §11). Geometry bugs hide in cases nobody writes by hand.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { apply, type Command } from "./commands";
import { applyChanges, diff } from "./diff";
import { changedIds, entities } from "./entities";
import { toLocal, toWorld } from "./frames";
import { EMPTY_HISTORY, record, redo, undo } from "./history";
import { normalize } from "./normalize";
import { SNAP_PX } from "./limits";
import { snapDelta } from "./snap";
import { entrance, face, fixture, rectangle, store, zone } from "./test-layouts";
import type { Layout } from "./types";
import { newIssues, validate } from "./validate";

const coord = fc.integer({ min: 0, max: 2000 });
const angle = fc.integer({ min: 0, max: 359 });

/** Random layouts in a 40 × 30 ft store: tables anywhere, two zones, an entrance. */
const layoutArb: fc.Arbitrary<Layout> = fc
  .record({
    tables: fc.array(fc.record({ x: fc.integer({ min: 40, max: 440 }), y: fc.integer({ min: 30, max: 330 }), r: fc.integer({ min: 0, max: 23 }) }), { maxLength: 6 }),
    zoneX: fc.integer({ min: 0, max: 200 }),
    entranceX: fc.integer({ min: 0, max: 480 }),
    entranceY: fc.integer({ min: 300, max: 400 }),
  })
  .map(({ tables, zoneX, entranceX, entranceY }) => ({
    ...store(),
    zones: [zone({ points: rectangle(zoneX, 0, 200, 150) }), zone({ id: "zone-b", name: "Zone B", points: rectangle(0, 200, 200, 150) })],
    fixtures: tables.map((t, i) => fixture({ id: `f${i}`, name: `Table ${i + 1}`, x: t.x, y: t.y, rotation: t.r * 15 })),
    faces: tables.map((_, i) => face({ id: `face${i}`, fixtureId: `f${i}` })),
    entrances: [entrance({ x: entranceX, y: entranceY })],
  }));

const commandArb = (layout: Layout): fc.Arbitrary<Command> => {
  const ids = layout.fixtures.map((f) => f.id);
  if (ids.length === 0) return fc.constant<Command>({ type: "setOutline", points: rectangle(0, 0, 480, 360) });
  const id = fc.constantFrom(...ids);
  return fc.oneof(
    fc.record({ id, dx: fc.integer({ min: -60, max: 60 }), dy: fc.integer({ min: -60, max: 60 }) }).map(({ id, dx, dy }): Command => ({ type: "move", ids: [id], delta: { x: dx, y: dy } })),
    fc.record({ id, r: angle }).map(({ id, r }): Command => ({ type: "updateFixture", id, changes: { rotation: r } })),
    id.map((i): Command => ({ type: "delete", ids: [i] })),
    id.map((i): Command => ({ type: "attachLowerTable", upperId: i, side: "front" })),
  );
};

function ids() {
  let n = 0;
  return () => `p-${++n}`;
}

describe("properties", () => {
  it("toWorld undoes toLocal at every angle", () => {
    fc.assert(
      fc.property(coord, coord, angle, coord, coord, (x, y, rotation, px, py) => {
        const pose = { x, y, rotation };
        const back = toWorld(pose, toLocal(pose, { x: px, y: py }));
        expect(back.x).toBeCloseTo(px, 6);
        expect(back.y).toBeCloseTo(py, 6);
      }),
    );
  });

  it("normalize is idempotent", () => {
    fc.assert(
      fc.property(layoutArb, (layout) => {
        const once = normalize(layout);
        expect(normalize(once)).toBe(once);
      }),
    );
  });

  it("applying a diff turns one layout into the other", () => {
    fc.assert(
      fc.property(layoutArb, layoutArb, (a, b) => {
        expect(entities(applyChanges(a, diff(a, b)))).toEqual(entities(b));
      }),
    );
  });

  it("undo then redo comes back to the same layout", () => {
    fc.assert(
      fc.property(layoutArb.chain((l) => fc.tuple(fc.constant(normalize(l)), commandArb(normalize(l)))), ([before, command]) => {
        const after = apply(before, command, ids());
        const history = record(EMPTY_HISTORY, before, after);
        const undone = undo(history, after);
        if (history.past.length === 0) return; // nothing changed, nothing recorded
        expect(undone).not.toBeNull();
        expect(entities(undone!.layout)).toEqual(entities(before));
        const redone = redo(undone!.history, undone!.layout);
        expect(entities(redone!.layout)).toEqual(entities(after));
      }),
    );
  });

  it("snapping moves each axis by at most the threshold, plus rounding", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ x: coord, y: coord }), { minLength: 1, maxLength: 4 }),
        fc.record({ x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }) }),
        fc.array(coord, { maxLength: 6 }),
        fc.array(coord, { maxLength: 6 }),
        fc.double({ min: 0.05, max: 4, noNaN: true }),
        (moving, delta, xs, ys, scale) => {
          const result = snapDelta(moving, delta, { xs, ys }, scale);
          expect(Math.abs(result.delta.x - delta.x)).toBeLessThanOrEqual(SNAP_PX / scale + 0.5);
          expect(Math.abs(result.delta.y - delta.y)).toBeLessThanOrEqual(SNAP_PX / scale + 0.5);
        },
      ),
    );
  });

  it("normalize never introduces a problem", () => {
    fc.assert(
      fc.property(layoutArb, (layout) => {
        const next = normalize(layout);
        const changed = changedIds(layout, next);
        expect(newIssues(validate(layout, changed), validate(next, changed), changed)).toEqual([]);
      }),
    );
  });

  it("any change the editor accepts, the server accepts too", () => {
    // The server applies the diff to its copy, normalizes and validates
    // (spec §8 step 5). It must agree with the editor's own gate.
    fc.assert(
      fc.property(layoutArb.chain((l) => fc.tuple(fc.constant(normalize(l)), commandArb(normalize(l)))), ([before, command]) => {
        const after = apply(before, command, ids());
        const changed = changedIds(before, after);
        const editorOk = newIssues(validate(before, changed), validate(after, changed), changed).length === 0;
        fc.pre(editorOk);
        const server = normalize(applyChanges(before, diff(before, after)));
        const serverChanged = changedIds(before, server);
        expect(newIssues(validate(before, serverChanged), validate(server, serverChanged), serverChanged)).toEqual([]);
        expect(entities(server)).toEqual(entities(after));
      }),
    );
  });

  it("snapping lands exactly on a target just inside the threshold", () => {
    // The property above only bounds the move; this pins that it happens.
    const result = snapDelta([{ x: 100, y: 100 }], { x: 10, y: 10 }, { xs: [113], ys: [113] }, 1);
    expect(result.delta).toEqual({ x: 13, y: 13 });
    expect(result.guides).toEqual([
      { axis: "x", value: 113 },
      { axis: "y", value: 113 },
    ]);
  });
});
