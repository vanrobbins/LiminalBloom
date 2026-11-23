import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES, type BuiltinRoleKey } from "@/lib/access/roles";

import { adjustCommands, commandsFor } from "./commands";
import type { PaletteIndex, PaletteProducts } from "./types";

const stores = [{ id: "s1", name: "Main St" }];
const labels = (switches: readonly string[], opts: { stores?: typeof stores; theme?: "light" | "dark" } = {}) =>
  commandsFor({ switches: switches as never }, opts.stores ?? stores, "s1", opts.theme ?? "light").map((c) => c.label);
const forRole = (key: BuiltinRoleKey) => labels(BUILTIN_ROLES.find((r) => r.key === key)!.switches);

const GO_TO = ["Hub", "Products", "Layout", "Planograms", "Store", "Account", "Two-step sign-in", "Help", "Products not placed", "Sold out products"];
const EVERYONE = [...GO_TO, "Switch to dark theme", "Create a store"];
const EDITOR = ["Add product", "Categories", "Edit the store map"];

describe("commandsFor, per built-in role (spec §3.3)", () => {
  it("gives a Store Manager and an Assistant Manager everything, Roles included", () => {
    for (const key of ["store_manager", "assistant_manager"] as const) {
      expect(forRole(key).slice().sort()).toEqual([...EVERYONE, ...EDITOR, "Roles and permissions"].sort());
    }
  });

  it("gives a VM Manager the editor actions but not Roles and permissions", () => {
    expect(forRole("vm_manager").slice().sort()).toEqual([...EVERYONE, ...EDITOR].sort());
  });

  it("gives a VM Worker and a Sales Associate pages and the common actions only", () => {
    for (const key of ["vm_worker", "sales_associate"] as const) {
      expect(forRole(key).slice().sort()).toEqual([...EVERYONE].sort());
    }
  });
});

describe("commandsFor, the rest", () => {
  it("gives a custom role view + layout.edit the map editor and no Add product", () => {
    const out = labels(["view", "layout.edit"]);
    expect(out).toContain("Edit the store map");
    expect(out).not.toContain("Add product");
    expect(out).not.toContain("Categories");
    expect(out).not.toContain("Roles and permissions");
  });

  it("offers each other store to switch to, and none when there is only one", () => {
    expect(labels(["view"])).not.toContain("Switch to Main St");
    const two = labels(["view"], { stores: [...stores, { id: "s2", name: "Elm Ave" }] });
    expect(two).toContain("Switch to Elm Ave");
    expect(two).not.toContain("Switch to Main St");
  });

  it("names the opposite theme", () => {
    expect(labels(["view"], { theme: "dark" })).toContain("Switch to light theme");
    expect(labels(["view"], { theme: "light" })).toContain("Switch to dark theme");
  });

  it("points at the right places", () => {
    const all = commandsFor({ switches: BUILTIN_ROLES[0].switches }, stores, "s1", "light");
    const target = (label: string) => (all.find((c) => c.label === label) as { target: unknown }).target;
    expect(target("Store")).toEqual({ href: "/store" });
    expect(target("Roles and permissions")).toEqual({ href: "/store/roles" });
    expect(target("Products not placed")).toEqual({ href: "/products?place=unplaced" });
    expect(target("Sold out products")).toEqual({ href: "/products?status=sold_out" });
    expect(target("Edit the store map")).toEqual({ href: "/layout/edit" });
    expect(target("Switch to dark theme")).toEqual({ theme: true });
    expect(target("Create a store")).toEqual({ href: "/create-store" });
  });

  it("finds Store by its keywords", () => {
    const store = commandsFor({ switches: ["view"] }, stores, "s1", "light").find((c) => c.label === "Store");
    expect(store?.keywords).toContain("people");
  });

  it("lists the pages under Go to and the rest under Actions", () => {
    const out = commandsFor({ switches: BUILTIN_ROLES[0].switches }, stores, "s1", "light");
    expect(out.filter((c) => c.kind === "page").map((c) => c.label)).toEqual(GO_TO);
    expect(out.filter((c) => c.kind === "action").length).toBeGreaterThan(0);
  });
});

// 0.7.0.9 (DECISIONS 11-17, Q7): Quick Adjust <fixture> and Adjust <product> extend spec §3.3 on purpose.
describe("adjustCommands", () => {
  const index: PaletteIndex = {
    planograms: [
      { fixtureId: "f1", name: "Front table", typeHint: "Table", zoneName: "Entry", state: "Version 3", published: true },
      { fixtureId: "f2", name: "Wall A", zoneName: "Denim", state: "Draft" },
    ],
    zones: [],
  };
  const found: PaletteProducts = {
    products: [
      { id: "p1", name: "Navy Tee", styleNumber: "NT-1", status: "sold_out", place: "Front table", more: 0, adjustFixtureId: "f1" },
      { id: "p2", name: "Black Pant", styleNumber: "BP-1", status: "in_stock", place: "Wall A", more: 0 },
    ],
    total: 2,
  };
  const drafter = { switches: ["view", "planograms.draft"] as never };
  const labels = (holder: { switches: never }, i: PaletteIndex | null = index, p: PaletteProducts | null = found) => adjustCommands(holder, i, p).map((c) => c.label);

  it("offers Quick Adjust for a planogram with a published version, and Adjust for a product the answer names a fixture for", () => {
    expect(labels(drafter)).toEqual(["Quick Adjust Front table", "Adjust Navy Tee"]);
  });

  it("points them at the adjust page, the product one with ?product=, as actions", () => {
    const [fixture, product] = adjustCommands(drafter, index, found);
    expect(fixture).toMatchObject({ kind: "action", id: "action:adjust:planogram:f1", target: { href: "/planograms/f1/adjust" } });
    expect(product).toMatchObject({ kind: "action", id: "action:adjust:product:p1", target: { href: "/planograms/f1/adjust?product=p1" } });
  });

  it("needs planograms.draft: nothing for publish alone, for view, or for the built-in roles without it", () => {
    expect(labels({ switches: ["view", "planograms.publish"] as never })).toEqual([]);
    expect(labels({ switches: ["view", "products.stock"] as never })).toEqual([]);
    expect(labels({ switches: BUILTIN_ROLES.find((r) => r.key === "sales_associate")!.switches as never })).toEqual([]);
    expect(labels({ switches: BUILTIN_ROLES.find((r) => r.key === "vm_worker")!.switches as never }).length).toBe(2);
  });

  it("is empty until the answers arrive", () => {
    expect(labels(drafter, null, null)).toEqual([]);
    expect(labels(drafter, index, null)).toEqual(["Quick Adjust Front table"]);
  });

  it("is a separate list: commandsFor never carries them, so the empty-query Actions stay as the spec's table", () => {
    expect(commandsFor(drafter, stores, "s1", "light").some((c) => c.label.includes("Adjust"))).toBe(false);
  });
});
