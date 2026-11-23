import { describe, expect, it } from "vitest";

import { BUILTIN_ROLES, type BuiltinRoleKey } from "@/lib/access/roles";
import type { Switch } from "@/lib/access/switches";

import { CARD_ORDER, cardAllowed, readsFor, shownCards } from "./cards";
import type { CardKey, HomeData } from "./types";

const holder = (switches: Switch[]) => ({ switches });
const roleHolder = (key: BuiltinRoleKey) => holder([...BUILTIN_ROLES.find((r) => r.key === key)!.switches]);
const allowed = (h: { switches: readonly Switch[] }) => CARD_ORDER.filter((k) => cardAllowed(h, k));

// Spec 0.7.0.6 section 4: what each built-in role sees by default.
const TABLE: Record<BuiltinRoleKey, CardKey[]> = {
  store_manager: ["setup", "planograms", "soldOut", "invitations", "notPlaced", "published", "changes"],
  assistant_manager: ["setup", "planograms", "soldOut", "invitations", "notPlaced", "published", "changes"],
  vm_manager: ["setup", "planograms", "soldOut", "invitations", "notPlaced", "published"],
  vm_worker: ["planograms", "soldOut", "notPlaced", "published"],
  sales_associate: ["published"],
};

describe("cardAllowed", () => {
  it("has the fixed card order", () => {
    // "Sold out on display" sits right after "Planograms to finish" (0.7.0.9, DECISIONS 11-17 Q6).
    expect(CARD_ORDER).toEqual(["setup", "planograms", "soldOut", "invitations", "notPlaced", "published", "changes"]);
  });

  for (const [key, cards] of Object.entries(TABLE)) {
    it(`${key} gets exactly its default cards`, () => {
      expect(allowed(roleHolder(key as BuiltinRoleKey))).toEqual(cards);
    });
  }

  it("a custom role with view + planograms.publish gets card 2 and not 4", () => {
    const h = holder(["view", "planograms.publish"]);
    expect(cardAllowed(h, "planograms")).toBe(true);
    expect(cardAllowed(h, "notPlaced")).toBe(false);
    expect(cardAllowed(h, "soldOut")).toBe(false);
  });

  it("each single switch opens its own cards", () => {
    expect(allowed(holder(["view"]))).toEqual(["published"]);
    expect(allowed(holder(["layout.edit"]))).toEqual(["setup"]);
    expect(allowed(holder(["products.edit"]))).toEqual(["setup"]);
    expect(allowed(holder(["people.manage"]))).toEqual(["setup", "invitations"]);
    expect(allowed(holder(["roles.manage"]))).toEqual(["changes"]);
    expect(allowed(holder(["planograms.draft"]))).toEqual(["planograms", "soldOut", "notPlaced"]);
  });
});

describe("readsFor", () => {
  it("gives a Sales Associate only the home batch", () => {
    expect(readsFor(roleHolder("sales_associate"))).toEqual({ planograms: false, summaries: false, invitations: false, activity: false, soldOut: false, batch: true });
  });
  it("counts sold-out products on display only for planograms.draft, never for publish alone", () => {
    expect(readsFor(holder(["view", "planograms.draft"])).soldOut).toBe(true);
    expect(readsFor(holder(["view", "planograms.publish"])).soldOut).toBe(false);
    expect(readsFor(holder(["view", "products.stock"])).soldOut).toBe(false);
  });
  it("reads planograms for draft, publish or layout.edit", () => {
    for (const s of ["planograms.draft", "planograms.publish", "layout.edit"] as const) expect(readsFor(holder(["view", s])).planograms).toBe(true);
    expect(readsFor(holder(["view", "products.edit", "people.manage", "roles.manage"])).planograms).toBe(false);
  });
  it("reads planogram summaries only for draft or publish, not layout.edit alone", () => {
    expect(readsFor(holder(["view", "layout.edit"])).summaries).toBe(false);
    for (const s of ["planograms.draft", "planograms.publish"] as const) expect(readsFor(holder(["view", s])).summaries).toBe(true);
  });
  it("reads invitations only with people.manage", () => {
    expect(readsFor(holder(["view", "roles.manage", "planograms.draft"])).invitations).toBe(false);
    expect(readsFor(holder(["view", "people.manage"])).invitations).toBe(true);
  });
  it("reads activity only with roles.manage", () => {
    expect(readsFor(holder(["view", "people.manage"])).activity).toBe(false);
    expect(readsFor(holder(["view", "roles.manage"])).activity).toBe(true);
  });
  it("always runs the home batch", () => {
    expect(readsFor(holder([])).batch).toBe(true);
  });
});

describe("shownCards", () => {
  const full: HomeData = {
    setup: [{ key: "layout", label: "Draw the store layout", href: "/layout/edit" }],
    planograms: { rows: [{ fixtureId: "a", name: "A", typeLabel: "Rack", publishedVersion: null, publishedAt: null, hasDraft: true, dueDate: null, overdue: false }], total: 1, today: "2026-11-16" },
    invitations: [{ id: "i", email: "a@b.c", roleName: "VM Worker", state: "pending", expiresAt: new Date(0) }],
    soldOut: { products: 3 },
    notPlaced: { products: 2, fixtures: 0 },
    published: [{ fixtureId: "a", fixtureName: "A", version: 1, publisherName: "Pat", publishedAt: new Date(0) }],
    changes: [{ id: "e", text: "Pat changed a role", at: new Date(0) }],
  };

  it("returns allowed, non-empty cards in order", () => {
    expect(shownCards(roleHolder("store_manager"), full)).toEqual(CARD_ORDER);
    expect(shownCards(roleHolder("vm_worker"), full)).toEqual(["planograms", "soldOut", "notPlaced", "published"]);
  });
  it("hides empty cards and cards with no data", () => {
    const data: HomeData = { ...full, setup: [], planograms: { rows: [], total: 0, today: "2026-11-16" }, invitations: undefined, soldOut: { products: 0 }, notPlaced: { products: 0, fixtures: 0 }, changes: [] };
    expect(shownCards(roleHolder("store_manager"), data)).toEqual(["published"]);
  });
  it("shows Not placed when only one count is above zero", () => {
    expect(shownCards(roleHolder("vm_worker"), { notPlaced: { products: 0, fixtures: 3 } })).toEqual(["notPlaced"]);
  });
  it("shows Sold out on display only with a count above zero, and never to a viewer without planograms.draft", () => {
    expect(shownCards(roleHolder("vm_worker"), { soldOut: { products: 1 } })).toEqual(["soldOut"]);
    expect(shownCards(roleHolder("vm_worker"), { soldOut: { products: 0 } })).toEqual([]);
    expect(shownCards(holder(["view", "planograms.publish"]), { soldOut: { products: 4 } })).toEqual([]);
  });
  it("never shows data a viewer is not allowed", () => {
    expect(shownCards(roleHolder("sales_associate"), full)).toEqual(["published"]);
  });
  it("is empty when nothing applies", () => {
    expect(shownCards(roleHolder("sales_associate"), {})).toEqual([]);
  });
});
