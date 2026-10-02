import { describe, expect, it } from "vitest";

import { applyChanges } from "./diff";
import { keyOf } from "./entities";
import { begin, conflictNotice, createQueue, failed, hasPending, rebase } from "./save-queue";
import { fixture, store, zone } from "./test-layouts";

const base = { ...store(), zones: [zone()], fixtures: [fixture()] };

describe("begin", () => {
  it("sends only what changed, and only one request at a time", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const started = begin(createQueue(base), present)!;
    expect(started.request.zones).toHaveLength(1);
    expect(started.request.fixtures).toHaveLength(0);
    expect(begin(started.queue, present)).toBeNull();
    expect(hasPending(started.queue, present)).toBe(true);
  });

  it("has nothing to send when nothing changed", () => {
    expect(begin(createQueue(base), base)).toBeNull();
    expect(hasPending(createQueue(base), base)).toBe(false);
  });
});

describe("failed", () => {
  it("backs off 1 s, 2 s, 4 s … up to 30 s", () => {
    let queue = createQueue(base);
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      const result = failed(queue);
      delays.push(result.retryInMs);
      queue = result.queue;
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(queue.inFlight).toBeNull();
  });
});

describe("rebase", () => {
  it("brings in another device's edits and keeps this device's unsaved ones", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const server = { ...base, fixtures: [fixture({ name: "Their table", version: 2 })] };
    const result = rebase(present, base, server);
    expect(result.layout.zones[0]).toMatchObject({ name: "Windows", version: 1 });
    expect(result.layout.fixtures[0]).toMatchObject({ name: "Their table", version: 2 });
    expect(result.dropped.size).toBe(0);
  });

  it("never silently overwrites another device's later edit to an item this device has not sent yet (spec §1)", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const server = { ...base, zones: [zone({ name: "Theirs", version: 2 })] };
    const result = rebase(present, base, server, new Set(), new Set());
    expect(result.layout.zones[0]).toMatchObject({ name: "Theirs", version: 2 });
    expect(result.dropped).toEqual(new Set([keyOf("zones", "zone-a")]));
    expect(conflictNotice(result)).toBe("Windows was changed on another device.");
  });

  it("keeps a further change to an item that was in the sent request, on the server's new version", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const server = { ...base, zones: [zone({ name: "Front", version: 2 })] };
    const result = rebase(present, base, server, new Set(), new Set(["zone-a"]));
    expect(result.layout.zones[0]).toMatchObject({ name: "Windows", version: 2 });
    expect(result.dropped.size).toBe(0);
  });

  it("drops a pending delete of an item another device has since changed, and names it", () => {
    const present = { ...base, zones: [] };
    const server = { ...base, zones: [zone({ name: "Theirs", version: 2 })] };
    const result = rebase(present, base, server, new Set(), new Set());
    expect(result.layout.zones[0]).toMatchObject({ name: "Theirs", version: 2 });
    expect(conflictNotice(result)).toBe("Theirs was changed on another device.");
  });

  it("keeps a pending delete of an item that was in the sent request", () => {
    const present = { ...base, zones: [] };
    const server = { ...base, zones: [zone({ version: 2 })] };
    const result = rebase(present, base, server, new Set(), new Set(["zone-a"]));
    expect(result.layout.zones).toEqual([]);
    expect(result.dropped.size).toBe(0);
  });

  it("drops a change to something deleted elsewhere, and says so", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const server = { ...base, zones: [] };
    const result = rebase(present, base, server);
    expect(result.layout.zones).toEqual([]);
    expect(result.dropped).toEqual(new Set([keyOf("zones", "zone-a")]));
    expect(conflictNotice(result)).toBe("Windows was changed on another device.");
  });

  it("lets the server win for skipped (conflicting) items", () => {
    const present = { ...base, zones: [zone({ name: "Mine" })] };
    const server = { ...base, zones: [zone({ name: "Theirs", version: 2 })] };
    const result = rebase(present, base, server, new Set(["zone-a"]));
    expect(result.layout.zones[0].name).toBe("Theirs");
  });

  it("after a save, treats what was sent as saved", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const started = begin(createQueue(base), present)!;
    const sentBase = applyChanges(base, started.request);
    const server = { ...present, zones: [zone({ name: "Windows", version: 2 })] };
    expect(rebase(present, sentBase, server).layout.zones[0]).toMatchObject({ name: "Windows", version: 2 });
  });

  it("does not re-apply a change that was already sent when someone edited after it", () => {
    const present = { ...base, zones: [zone({ name: "Windows" })] };
    const started = begin(createQueue(base), present)!;
    const sentBase = applyChanges(base, started.request);
    const server = { ...base, zones: [zone({ name: "Theirs", version: 3 })] };
    const result = rebase(present, sentBase, server);
    expect(result.layout.zones[0].name).toBe("Theirs");
    expect(result.dropped.size).toBe(0);
  });
});

describe("conflictNotice", () => {
  it("does not name one item when other drops had no name", () => {
    const rebased = {
      layout: base,
      dropped: new Set([keyOf("zones", "zone-a"), keyOf("faces", "face-a")]),
      droppedNames: ["Windows"],
    };
    expect(conflictNotice(rebased)).toBe("Some changes were made on another device.");
  });
});
