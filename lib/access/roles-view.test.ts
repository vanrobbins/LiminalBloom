import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES } from "./roles";
import { buildRoleRows, cellEnabled, changeSummary, differsFromDefault, EDITABLE_SWITCHES, permissionCount, roleActions, type RoleInput, type RoleRow } from "./roles-view";
import { SWITCHES, SWITCH_TEXT, type Switch } from "./switches";

const input = (): RoleInput[] =>
  BUILTIN_ROLES.map((r) => ({ id: r.key, name: r.name, rank: r.rank, builtin: r.key, version: 1, switches: [...r.switches], requiresTwoFactor: false, people: { names: [], invitations: 0 } }));
const custom = (id: string, rank: number, switches: Switch[]): RoleInput => ({ id, name: id, rank, builtin: null, version: 1, switches, requiresTwoFactor: false, people: { names: ["Dee"], invitations: 1 } });
const actor = (key: string, ...extra: Switch[]) => {
  const role = BUILTIN_ROLES.find((r) => r.key === key)!;
  return { rank: role.rank, switches: new Set<Switch>([...role.switches, ...extra]) };
};
const rowsFor = (key: string, more: RoleInput[] = []) => buildRoleRows([...input(), ...more], actor(key), key);
const by = (rows: RoleRow[], id: string) => rows.find((r) => r.id === id)!;

describe("buildRoleRows", () => {
  it("lists the roles in rank order", () => {
    expect(buildRoleRows([...input()].reverse(), actor("store_manager"), null).map((r) => r.id)).toEqual(BUILTIN_ROLES.map((r) => r.key));
  });

  it("makes every row below the Store Manager editable and the Store Manager's own row read-only with its three locked", () => {
    const rows = rowsFor("store_manager");
    expect(rows.map((r) => r.editable)).toEqual([false, true, true, true, true]);
    expect(by(rows, "store_manager")).toMatchObject({ relation: "you", locked: ["people.manage", "roles.manage", "store.settings"] });
    expect(by(rows, "vm_worker")).toMatchObject({ relation: null, locked: [] });
  });

  it("makes an Assistant Manager's own row and the Store Manager's read-only, 'Your role' and 'Above you'", () => {
    const rows = rowsFor("assistant_manager");
    expect(by(rows, "store_manager")).toMatchObject({ editable: false, relation: "above" });
    expect(by(rows, "assistant_manager")).toMatchObject({ editable: false, relation: "you" });
    expect(by(rows, "vm_manager").editable).toBe(true);
  });

  it("makes nothing editable without roles.manage, whatever the rank", () => {
    expect(rowsFor("vm_manager").some((r) => r.editable)).toBe(false);
    expect(rowsFor("sales_associate").some((r) => r.editable)).toBe(false);
  });

  it("offers Move up and Move down only on custom roles, never up past the viewer's own role, and not off either end", () => {
    const rows = rowsFor("assistant_manager", [custom("top", 250, ["view"]), custom("bottom", 600, ["view"])]);
    expect(rows.map((r) => [r.id, r.upId, r.downId]).filter(([id]) => id === "top" || id === "bottom" || id === "vm_worker")).toEqual([
      ["top", null, "vm_manager"],
      ["vm_worker", null, null],
      ["bottom", "sales_associate", null],
    ]);
  });

  it("keeps the people as given, and a stored switch list safe (unknown values ignored, view always there)", () => {
    const rows = buildRoleRows([{ ...custom("x", 600, []), switches: ["products.sale", "root.access", 7] }], actor("store_manager"), null);
    expect(rows[0].switches).toEqual(["view", "products.sale"]);
    expect(rows[0].people).toEqual({ names: ["Dee"], invitations: 1 });
  });
});

describe("cellEnabled", () => {
  it("needs an editable row, a cell that isn't locked, and a permission the viewer holds", () => {
    const am = rowsFor("assistant_manager");
    const holds = [...actor("assistant_manager").switches];
    expect(cellEnabled(by(am, "vm_worker"), "products.sale", holds)).toBe(true);
    // An Assistant Manager lacks store.settings, so that column is off on every row.
    expect(EDITABLE_SWITCHES.filter((s) => am.some((r) => cellEnabled(r, s, holds)))).not.toContain("store.settings");
    expect(cellEnabled(by(am, "assistant_manager"), "products.sale", holds)).toBe(false);
    const sm = rowsFor("store_manager");
    expect(cellEnabled(by(sm, "store_manager"), "products.sale", [...SWITCHES])).toBe(false);
  });

  it("holds a custom role with roles.manage but no products.edit out of that column, and nothing else", () => {
    const holds: Switch[] = ["view", "roles.manage", "products.sale"];
    const rows = buildRoleRows([...input(), custom("editor", 250, ["view", "roles.manage"])], { rank: 250, switches: new Set(holds) }, "editor");
    expect(cellEnabled(by(rows, "vm_worker"), "products.edit", holds)).toBe(false);
    expect(cellEnabled(by(rows, "vm_worker"), "products.sale", holds)).toBe(true);
    expect(cellEnabled(by(rows, "vm_manager"), "products.edit", holds)).toBe(false);
  });
});

describe("changeSummary and permissionCount", () => {
  it("lists what was added, what was removed and everything after, in the summary's words", () => {
    const out = changeSummary(["view", "products.stock"], ["view", "products.sale"]);
    expect(out.added).toEqual([SWITCH_TEXT["products.sale"].can]);
    expect(out.removed).toEqual([SWITCH_TEXT["products.stock"].can]);
    expect(out.now).toEqual([SWITCH_TEXT.view.can, SWITCH_TEXT["products.sale"].can]);
  });

  it("counts the permissions that have a column, not `view`", () => {
    expect(permissionCount(["view", "products.stock"])).toBe("1 of 9 permissions");
    expect(permissionCount([...SWITCHES])).toBe("9 of 9 permissions");
  });
});

describe("roleActions and differsFromDefault", () => {
  it("offers a built-in Rename, and Reset only when it differs from its default; never Delete", () => {
    const row = by(rowsFor("store_manager"), "vm_worker");
    expect(differsFromDefault(row)).toBe(false);
    expect(roleActions(row).map((a) => a.key)).toEqual(["rename", "two-factor"]);
    expect(roleActions({ ...row, name: "Floor" }).map((a) => a.key)).toEqual(["rename", "two-factor", "reset"]);
    expect(roleActions({ ...row, switches: ["view"] }).map((a) => a.key)).toContain("reset");
  });

  it("offers a custom role Rename, the moves that apply, and Delete; and nothing on a read-only row", () => {
    const rows = rowsFor("store_manager", [custom("mid", 450, ["view"])]);
    expect(roleActions(by(rows, "mid")).map((a) => a.key)).toEqual(["rename", "two-factor", "up", "down", "delete"]);
    expect(roleActions(by(rows, "store_manager"))).toEqual([]);
  });

  it("words the two-factor item by what it would do, and carries the saved setting on the row", () => {
    const row = by(rowsFor("store_manager", [{ ...custom("mid", 450, ["view"]), requiresTwoFactor: true }]), "mid");
    expect(row.requiresTwoFactor).toBe(true);
    expect(roleActions(row).find((a) => a.key === "two-factor")?.label).toBe("Stop requiring two-factor");
    expect(roleActions({ ...row, requiresTwoFactor: false }).find((a) => a.key === "two-factor")?.label).toBe("Require two-factor");
  });
});
