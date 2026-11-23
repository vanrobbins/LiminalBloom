import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES } from "@/lib/access/roles";
import { buildRoleRows, type RoleRow } from "@/lib/access/roles-view";
import { SWITCHES, type Switch } from "@/lib/access/switches";

import { cellNote, changedRows, stagedProblem, switchesOf, toggled, type Staged } from "./staged";

const rows: RoleRow[] = buildRoleRows(
  BUILTIN_ROLES.map((r) => ({ id: r.key, name: r.name, rank: r.rank, builtin: r.key, version: 1, switches: [...r.switches], requiresTwoFactor: false, people: { names: [], invitations: 0 } })),
  { rank: 100, switches: new Set(SWITCHES) },
  "store_manager",
);
const row = (id: string) => rows.find((r) => r.id === id)!;

describe("toggled", () => {
  it("stages a flipped permission, in list order, and unstages it when flipped back", () => {
    const sa = row("sales_associate");
    const once = toggled({}, sa, "products.sale");
    expect(once).toEqual({ sales_associate: ["view", "products.stock", "products.sale"] });
    expect(toggled(once, sa, "products.sale")).toEqual({});
  });

  it("is its own inverse for any permission of any role (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...rows), fc.constantFrom(...SWITCHES), (r, s) => {
        const staged = toggled({}, r, s);
        return JSON.stringify(toggled(staged, r, s)) === "{}" && switchesOf(r, staged).includes(s) !== r.switches.includes(s);
      }),
    );
  });

  it("lists the changed roles in rank order", () => {
    const staged: Staged = { ...toggled({}, row("vm_worker"), "layout.edit"), ...toggled({}, row("assistant_manager"), "products.stock") };
    expect(changedRows(rows, staged).map((r) => r.id)).toEqual(["assistant_manager", "vm_worker"]);
  });
});

describe("the staged state's nesting", () => {
  it("is fine for the shipped roles and for a change that nests", () => {
    expect(stagedProblem(rows, {})).toBeNull();
    expect(stagedProblem(rows, toggled({}, row("sales_associate"), "products.stock"))).toBeNull();
  });

  it("names the blocking role for a change turned on below a role that lacks it, and for one turned off above a role that has it", () => {
    expect(stagedProblem(rows, toggled({}, row("vm_manager"), "store.settings"))).toMatchObject({ direction: "on", role: { name: "Visual Merchandising Manager" }, other: { name: "Assistant Manager" } });
    expect(stagedProblem(rows, toggled({}, row("assistant_manager"), "products.edit"))).toMatchObject({ direction: "off", role: { name: "Assistant Manager" }, other: { name: "Visual Merchandising Manager" } });
  });

  it("accepts a column turned off bottom-up whichever order the cells were staged", () => {
    const order: [string, Switch][] = [["assistant_manager", "products.edit"], ["vm_manager", "products.edit"]];
    for (const sequence of [order, [...order].reverse()]) {
      const staged = sequence.reduce((s, [id, sw]) => toggled(s, row(id), sw), {} as Staged);
      expect(stagedProblem(rows, staged)).toBeNull();
    }
  });
});

describe("cellNote", () => {
  it("explains a cell whose flip would run into another role, and is null for one that is free", () => {
    expect(cellNote(rows, {}, row("assistant_manager"), "products.edit")).toBe("Visual Merchandising Manager can still edit products; turn it off there first.");
    expect(cellNote(rows, {}, row("vm_manager"), "store.settings")).toBe("Assistant Manager can't change store settings, so Visual Merchandising Manager can't either.");
    expect(cellNote(rows, {}, row("sales_associate"), "products.stock")).toBeNull();
  });
});
