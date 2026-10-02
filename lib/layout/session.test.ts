import { describe, expect, it } from "vitest";

import { canUndo } from "./history";
import { createSession } from "./session-core";
import { fixture, store, zone } from "./test-layouts";
import { editing, reducer } from "./test-sessions";

describe("viewport", () => {
  it("stays finite at zero size, then fits the store once measured (Review Focus 3)", () => {
    const reduce = reducer();
    let session = createSession(store(), false);
    session = reduce(session, { type: "viewport", viewport: { width: 0, height: 0 } });
    expect(Number.isFinite(session.camera.scale)).toBe(true);
    session = reduce(session, { type: "viewport", viewport: { width: 800, height: 600 } });
    expect(session.camera.scale).toBeCloseTo((600 - 48) / 360, 9);
  });

  it("does not refit on later resizes", () => {
    const reduce = reducer();
    const session = reduce(editing(store()), { type: "viewport", viewport: { width: 400, height: 300 } });
    expect(session.camera.scale).toBe(1);
  });
});

describe("commands through the gate", () => {
  it("keeps a valid change and records it", () => {
    const reduce = reducer();
    const session = reduce(editing({ ...store(), fixtures: [fixture()] }), {
      type: "command",
      command: { type: "move", ids: ["fixture-a"], delta: { x: 12, y: 0 } },
    });
    expect(session.layout.fixtures[0].x).toBe(312);
    expect(canUndo(session.history)).toBe(true);
  });

  it("refuses a change that blocks, and says why", () => {
    const reduce = reducer();
    const layout = { ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Table 2", x: 400 })] };
    const session = reduce(editing(layout), { type: "command", command: { type: "move", ids: ["b"], delta: { x: -60, y: 0 } } });
    expect(session.layout).toBe(layout);
    expect(session.notice).toBe("Blocked by Table 1.");
  });
});

describe("undo and redo", () => {
  it("walks back and forward", () => {
    const reduce = reducer();
    let session = reduce(editing({ ...store(), fixtures: [fixture()] }), {
      type: "command",
      command: { type: "move", ids: ["fixture-a"], delta: { x: 12, y: 0 } },
    });
    session = reduce(session, { type: "undo" });
    expect(session.layout.fixtures[0].x).toBe(300);
    session = reduce(session, { type: "redo" });
    expect(session.layout.fixtures[0].x).toBe(312);
  });
});

describe("focus and reveal", () => {
  it("focusing a zone fits the camera to it and clears the selection", () => {
    const reduce = reducer();
    const session = reduce({ ...editing({ ...store(), zones: [zone()] }), selection: ["zone-a"] }, {
      type: "focus",
      focus: { kind: "zone", id: "zone-a" },
    });
    expect(session.focus).toEqual({ kind: "zone", id: "zone-a" });
    expect(session.selection).toEqual([]);
    expect(session.camera.scale).toBeCloseTo((600 - 48) / 180, 9);
  });

  it("revealing a fixture opens its zone and selects it", () => {
    const reduce = reducer();
    const layout = { ...store(), zones: [zone()], fixtures: [fixture({ x: 100, y: 100, zoneId: "zone-a" })] };
    const session = reduce(editing(layout), { type: "reveal", id: "fixture-a" });
    expect(session.focus).toEqual({ kind: "zone", id: "zone-a" });
    expect(session.selection).toEqual(["fixture-a"]);
  });
});

describe("rebase", () => {
  it("brings in a remote change and keeps a drag going", () => {
    const reduce = reducer();
    const base = { ...store(), fixtures: [fixture(), fixture({ id: "b", name: "Table 2", x: 400 })] };
    const dragging = {
      ...editing(base),
      drag: { target: { kind: "fixture", id: "fixture-a" } as const, start: base, origin: { x: 300, y: 100 }, ids: ["fixture-a"] },
    };
    const server = { ...base, fixtures: [fixture({ version: 1 }), fixture({ id: "b", name: "Renamed", x: 400, version: 2 })] };
    const session = reduce(dragging, { type: "rebase", base, server, skip: [] });
    expect(session.layout.fixtures[1].name).toBe("Renamed");
    expect(session.drag?.start).toBe(session.layout);
  });
});

describe("rebase and the selected corner", () => {
  it("clears the corner when the server's polygon no longer has it", () => {
    const reduce = reducer();
    const base = { ...store(), zones: [zone()] };
    const picked = { ...editing(base), vertex: { owner: { kind: "zone", id: "zone-a" } as const, index: 3 } };
    const server = { ...base, zones: [] };
    expect(reduce(picked, { type: "rebase", base, server, skip: [] }).vertex).toBeNull();
  });
});

describe("replace", () => {
  it("starts over from the server's layout with a message", () => {
    const reduce = reducer();
    const session = reduce({ ...editing(store()), selection: ["outline"] }, { type: "replace", layout: store(240, 240), notice: "Reloaded." });
    expect(session.selection).toEqual([]);
    expect(session.notice).toBe("Reloaded.");
    expect(session.layout.outline?.points[1].x).toBe(240);
  });

  it("refits the camera to the store when it leaves a focused zone", () => {
    const reduce = reducer();
    const layout = { ...store(), zones: [zone()] };
    const focused = reduce(editing(layout), { type: "focus", focus: { kind: "zone", id: "zone-a" } });
    const session = reduce(focused, { type: "replace", layout, notice: "Reloaded." });
    expect(session.focus).toEqual({ kind: "overview" });
    expect(session.camera).toEqual(reduce(editing(layout), { type: "fit" }).camera);
    expect(session.camera).not.toEqual(focused.camera);
  });
});
