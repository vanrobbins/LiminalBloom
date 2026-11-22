import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES, type BuiltinRoleKey } from "@/lib/access/roles";

import { commandsFor } from "./commands";

const stores = [{ id: "s1", name: "Main St" }];
const labels = (switches: readonly string[], opts: { stores?: typeof stores; theme?: "light" | "dark" } = {}) =>
  commandsFor({ switches: switches as never }, opts.stores ?? stores, "s1", opts.theme ?? "light").map((c) => c.label);
const forRole = (key: BuiltinRoleKey) => labels(BUILTIN_ROLES.find((r) => r.key === key)!.switches);

const GO_TO = ["Home", "Products", "Layout", "Planograms", "Store", "Account", "Products not placed", "Sold out products"];
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
