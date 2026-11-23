import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES, LOCKED_SWITCHES, builtinRole, withLockedSwitches, type BuiltinRoleKey, requiresTwoFactorByDefault } from "./roles";
import { SWITCHES, type Switch } from "./switches";

// Spec 4.2, written out independently of the code: one character per switch
// after view, in list order. "x" is held, "-" is not; the three locked cells of
// the Store Manager are "x" too.
const TABLE: Record<BuiltinRoleKey, { name: string; rank: number; cells: string }> = {
  store_manager: { name: "Store Manager", rank: 100, cells: "xxxxxxxxx" },
  assistant_manager: { name: "Assistant Manager", rank: 200, cells: "xxxxxxxx-" },
  vm_manager: { name: "Visual Merchandising Manager", rank: 300, cells: "xxxxxxx--" },
  vm_worker: { name: "Visual Merchandising Worker", rank: 400, cells: "xxx------" },
  sales_associate: { name: "Sales Associate", rank: 500, cells: "x--------" },
};

const subsets = fc.subarray([...SWITCHES]).map((list) => new Set<Switch>(list));
const roleKey = fc.constantFrom<BuiltinRoleKey | null>(null, ...(Object.keys(TABLE) as BuiltinRoleKey[]));

describe("the built-in roles", () => {
  it("are the five, top rank first", () => {
    expect(BUILTIN_ROLES.map((r) => r.key)).toEqual(["store_manager", "assistant_manager", "vm_manager", "vm_worker", "sales_associate"]);
  });

  for (const [key, row] of Object.entries(TABLE) as [BuiltinRoleKey, (typeof TABLE)[BuiltinRoleKey]][]) {
    it(`${row.name} has its name and rank`, () => {
      expect(builtinRole(key).name).toBe(row.name);
      expect(builtinRole(key).rank).toBe(row.rank);
    });

    it(`${row.name} holds view by default`, () => {
      expect(builtinRole(key).switches).toContain("view");
    });

    SWITCHES.slice(1).forEach((sw, i) => {
      const held = row.cells[i] === "x";
      it(`${row.name} ${held ? "holds" : "lacks"} ${sw} by default`, () => {
        expect(builtinRole(key).switches.includes(sw)).toBe(held);
      });
    });
  }

  it("lists default switches in list order with no repeats", () => {
    for (const role of BUILTIN_ROLES) {
      expect(role.switches).toEqual(SWITCHES.filter((s) => role.switches.includes(s)));
    }
  });
});

describe("built-in data", () => {
  it("cannot be changed at runtime", () => {
    const list = builtinRole("store_manager").switches as Switch[];
    expect(() => list.push("view")).toThrow();
    expect(SWITCHES).toHaveLength(10);
    expect(Object.isFrozen(BUILTIN_ROLES)).toBe(true);
    expect(Object.isFrozen(LOCKED_SWITCHES)).toBe(true);
    expect(Object.isFrozen(LOCKED_SWITCHES.store_manager)).toBe(true);
  });
});

describe("withLockedSwitches", () => {
  it("adds view to any role", () => {
    expect([...withLockedSwitches(new Set(), null)]).toEqual(["view"]);
    expect([...withLockedSwitches(new Set(), "assistant_manager")]).toEqual(["view"]);
  });

  it("drops a value that is not a switch, leaving view", () => {
    expect([...withLockedSwitches(new Set(["teleport" as Switch]), null)]).toEqual(["view"]);
  });

  it("gives the Store Manager its three locked switches and no one else", () => {
    expect([...withLockedSwitches(new Set(), "store_manager")]).toEqual(["view", "people.manage", "roles.manage", "store.settings"]);
    expect(withLockedSwitches(new Set(), "vm_manager").has("people.manage")).toBe(false);
    expect(withLockedSwitches(new Set(), null).has("roles.manage")).toBe(false);
  });

  it("keeps whatever else was proposed, in list order", () => {
    expect([...withLockedSwitches(new Set<Switch>(["layout.edit", "products.sale"]), null)]).toEqual(["view", "products.sale", "layout.edit"]);
  });

  it("does not change its input", () => {
    const proposed = new Set<Switch>(["layout.edit"]);
    withLockedSwitches(proposed, "store_manager");
    expect([...proposed]).toEqual(["layout.edit"]);
  });

  it("states the locks", () => {
    expect(LOCKED_SWITCHES.store_manager).toEqual(["people.manage", "roles.manage", "store.settings"]);
  });

  it("is idempotent, always holds view, and the Store Manager always holds its locks", () => {
    fc.assert(
      fc.property(subsets, roleKey, (proposed, key) => {
        const once = withLockedSwitches(proposed, key);
        const twice = withLockedSwitches(once, key);
        const same = [...once].join() === [...twice].join();
        const locked = key !== "store_manager" || LOCKED_SWITCHES.store_manager.every((s) => once.has(s));
        return same && once.has("view") && locked && [...proposed].every((s) => once.has(s));
      }),
    );
  });

  it("leaves every built-in default unchanged", () => {
    for (const role of BUILTIN_ROLES) {
      expect([...withLockedSwitches(new Set(role.switches), role.key)]).toEqual([...role.switches]);
    }
  });
});

describe("requiresTwoFactorByDefault", () => {
  it("is on for a role holding people.manage or roles.manage, and off for the rest", () => {
    expect(requiresTwoFactorByDefault(["view", "people.manage"])).toBe(true);
    expect(requiresTwoFactorByDefault(["view", "roles.manage"])).toBe(true);
    expect(requiresTwoFactorByDefault(["view", "products.edit", "store.settings"])).toBe(false);
    expect(requiresTwoFactorByDefault([])).toBe(false);
  });

  it("agrees with the built-ins: the Store Manager, Assistant Manager and VM Manager, not the Worker or Associate", () => {
    expect(BUILTIN_ROLES.map((r) => [r.key, requiresTwoFactorByDefault(r.switches)])).toEqual([
      ["store_manager", true],
      ["assistant_manager", true],
      ["vm_manager", true],
      ["vm_worker", false],
      ["sales_associate", false],
    ]);
  });
});
