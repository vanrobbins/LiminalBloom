import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  allowedStatuses,
  canActOn,
  canGrant,
  statusChangeNeeds,
  type Actor,
  type StatusChangeNeed,
} from "./rank";
import type { ProductStatus } from "@/lib/product-status";

import { SWITCHES, type Switch } from "./switches";

const actor = (rank: number, ...held: Switch[]): Actor => ({ rank, switches: new Set<Switch>(["view", ...held]) });
const subsets = fc.subarray([...SWITCHES]).map((list) => new Set<Switch>(list));

describe("canActOn", () => {
  it("needs the switch and a strictly lower rank number", () => {
    expect(canActOn(actor(200, "people.manage"), 300, "people.manage")).toBe(true);
    expect(canActOn(actor(200), 300, "people.manage")).toBe(false);
    expect(canActOn(actor(200, "roles.manage"), 300, "people.manage")).toBe(false);
    expect(canActOn(actor(200, "roles.manage"), 300, "roles.manage")).toBe(true);
  });

  it("refuses an equal rank, so two Store Managers cannot act on each other", () => {
    expect(canActOn(actor(100, "people.manage"), 100, "people.manage")).toBe(false);
  });

  it("is never true at or above the actor's own rank, even holding the switch", () => {
    // The target is built as the actor's rank minus a non-negative step, so
    // equal rank (step 0) is common, and the switch is always held so that
    // only the rank can be the reason for refusing.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        subsets,
        fc.constantFrom("people.manage" as const, "roles.manage" as const),
        (rank, step, others, needs) => {
          const switches = new Set<Switch>([...others, needs]);
          return !canActOn({ rank, switches }, rank - step, needs);
        },
      ),
    );
  });

  it("refuses a target rank that is not a safe integer, even when the switch is held", () => {
    for (const bad of [NaN, Infinity, -Infinity, 100.5]) expect(canActOn(actor(100, "people.manage"), bad, "people.manage")).toBe(false);
  });

  it("refuses an actor rank that is not a safe integer", () => {
    expect(canActOn(actor(NaN, "people.manage"), 300, "people.manage")).toBe(false);
  });

  it("is true for any strictly lower rank when the switch is held", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 1, max: 1000 }), (rank, step) =>
        canActOn(actor(rank, "people.manage"), rank + step, "people.manage"),
      ),
    );
  });
});

describe("canGrant", () => {
  it("is true only when the actor holds every switch in the set", () => {
    const a = actor(200, "products.sale", "layout.edit");
    expect(canGrant(a, new Set<Switch>(["view", "products.sale"]))).toBe(true);
    expect(canGrant(a, new Set<Switch>(["products.sale", "planograms.publish"]))).toBe(false);
    expect(canGrant(a, new Set())).toBe(true);
  });

  it("is never true if the set holds a switch the actor lacks", () => {
    fc.assert(
      fc.property(subsets, subsets, (held, wanted) => {
        const lacksOne = [...wanted].some((s) => !held.has(s));
        return !lacksOne || !canGrant({ rank: 100, switches: held }, wanted);
      }),
    );
  });
});

// Spec 4.2: all nine pairs.
const TRANSITIONS: [ProductStatus, ProductStatus, StatusChangeNeed][] = [
  ["in_stock", "sold_out", "products.stock"],
  ["sold_out", "in_stock", "products.stock"],
  ["on_sale", "sold_out", "products.stock"],
  ["in_stock", "on_sale", "products.sale"],
  ["sold_out", "on_sale", "products.sale"],
  ["on_sale", "in_stock", "products.sale"],
  ["in_stock", "in_stock", "unchanged"],
  ["sold_out", "sold_out", "unchanged"],
  ["on_sale", "on_sale", "unchanged"],
];

describe("statusChangeNeeds", () => {
  it.each(TRANSITIONS)("%s to %s needs %s", (from, to, needs) => {
    expect(statusChangeNeeds(from, to)).toBe(needs);
  });
});

describe("allowedStatuses", () => {
  it("offers a Sales Associate (stock only) just sold out and back in stock, never a sale", () => {
    const held = new Set<Switch>(["view", "products.stock"]);
    expect(allowedStatuses("in_stock", held)).toEqual(["sold_out"]);
    expect(allowedStatuses("on_sale", held)).toEqual(["sold_out"]);
    expect(allowedStatuses("sold_out", held)).toEqual(["in_stock"]);
  });

  it("offers a sale-only role the sale changes", () => {
    const held = new Set<Switch>(["view", "products.sale"]);
    expect(allowedStatuses("in_stock", held)).toEqual(["on_sale"]);
    expect(allowedStatuses("sold_out", held)).toEqual(["on_sale"]);
    expect(allowedStatuses("on_sale", held)).toEqual(["in_stock"]);
  });

  it("never offers the current status", () => {
    const statuses = fc.constantFrom<ProductStatus>("in_stock", "sold_out", "on_sale");
    fc.assert(fc.property(statuses, subsets, (current, held) => !allowedStatuses(current, held).includes(current)));
  });

  it("offers both other statuses with both switches, and none with neither", () => {
    expect(allowedStatuses("in_stock", new Set<Switch>(["products.stock", "products.sale"]))).toEqual(["sold_out", "on_sale"]);
    expect(allowedStatuses("sold_out", new Set<Switch>(["view"]))).toEqual([]);
  });
});
