import { describe, expect, it } from "vitest";

import type { Switch } from "@/lib/access/switches";

import { setupSteps, type SetupFacts } from "./setup-steps";

const NEW_STORE: SetupFacts = { hasOutline: false, productCount: 0, memberCount: 1, pendingInvitations: 0 };
const ALL: { switches: Switch[] } = { switches: ["view", "layout.edit", "products.edit", "people.manage"] };
const keys = (f: SetupFacts, h: { switches: Switch[] } = ALL) => setupSteps(f, h).map((s) => s.key);

describe("setupSteps", () => {
  it("lists all three steps for a brand new store, with their links", () => {
    expect(setupSteps(NEW_STORE, ALL)).toEqual([
      { key: "layout", label: "Draw the store layout", href: "/layout/edit" },
      { key: "product", label: "Add the first product", href: "/products/new" },
      { key: "team", label: "Invite your team", href: "/people" },
    ]);
  });

  it("drops the layout step once there is an outline", () => {
    expect(keys({ ...NEW_STORE, hasOutline: true })).toEqual(["product", "team"]);
  });

  it("drops the product step once there is a product", () => {
    expect(keys({ ...NEW_STORE, productCount: 1 })).toEqual(["layout", "team"]);
  });

  it("drops the team step with a second member or a pending invitation", () => {
    expect(keys({ ...NEW_STORE, memberCount: 2 })).toEqual(["layout", "product"]);
    expect(keys({ ...NEW_STORE, pendingInvitations: 1 })).toEqual(["layout", "product"]);
  });

  it("is empty when everything is done", () => {
    expect(keys({ hasOutline: true, productCount: 5, memberCount: 3, pendingInvitations: 0 })).toEqual([]);
  });

  it("gates each row on its own switch", () => {
    expect(keys(NEW_STORE, { switches: ["view", "layout.edit"] })).toEqual(["layout"]);
    expect(keys(NEW_STORE, { switches: ["view", "products.edit"] })).toEqual(["product"]);
    expect(keys(NEW_STORE, { switches: ["view", "people.manage"] })).toEqual(["team"]);
    expect(keys(NEW_STORE, { switches: ["view"] })).toEqual([]);
  });
});
