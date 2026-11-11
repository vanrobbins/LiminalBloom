// changeStatus against the table in spec 0.7 §4.2: which switch each change needs, judged
// on the status the database holds, never one the browser claims. The reads and the write
// are stood in for, so "writes nothing" is a mock that was never called.

import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  productStatus: vi.fn(),
  setProductStatus: vi.fn(),
  productDetail: vi.fn(),
}));
vi.mock("@/lib/current-member");
vi.mock("@/lib/products/write", () => ({ productStatus: db.productStatus, setProductStatus: db.setProductStatus }));
vi.mock("@/lib/products/queries", () => ({ productDetail: db.productDetail }));

import type { Switch } from "@/lib/access/switches";
import { guardFor, memberWith } from "@/lib/access/test-guard";
import * as currentMember from "@/lib/current-member";
import type { ProductStatus } from "@/lib/product-status";

import { changeStatus } from "./status-actions";

let who = memberWith("store_a", ["view"]);
const as = (...switches: Switch[]) => {
  who = memberWith("store_a", ["view", ...switches]);
};
const id = randomUUID();
const fresh = { id, status: "on_sale", version: 9 };

beforeEach(() => {
  vi.clearAllMocks();
  as();
  vi.mocked(currentMember.requireSwitchForAction).mockImplementation(guardFor(() => who));
  db.productStatus.mockResolvedValue("in_stock");
  db.setProductStatus.mockResolvedValue({ status: "saved", version: 4 });
  db.productDetail.mockResolvedValue({ product: fresh });
});

// Spec §4.2, one row each.
const TABLE: [ProductStatus, ProductStatus, Switch, Switch][] = [
  ["in_stock", "sold_out", "products.stock", "products.sale"],
  ["sold_out", "in_stock", "products.stock", "products.sale"],
  ["on_sale", "sold_out", "products.stock", "products.sale"],
  ["in_stock", "on_sale", "products.sale", "products.stock"],
  ["sold_out", "on_sale", "products.sale", "products.stock"],
  ["on_sale", "in_stock", "products.sale", "products.stock"],
];

describe("changeStatus", () => {
  it.each(TABLE)("%s to %s needs %s", async (from, to, needs, other) => {
    db.productStatus.mockResolvedValue(from);

    as(); // view only
    expect(await changeStatus(id, 3, to)).toEqual({ status: "forbidden" });
    as(other); // the other status switch is no substitute
    expect(await changeStatus(id, 3, to)).toEqual({ status: "forbidden" });
    expect(db.setProductStatus).not.toHaveBeenCalled();

    as(needs);
    expect(await changeStatus(id, 3, to)).toEqual({ status: "saved", version: 4 });
    // Written only while the product still has the status the check was made against.
    expect(db.setProductStatus).toHaveBeenCalledWith("store_a", id, 3, from, to);
  });

  it("judges the change by the database's status, not the one the browser had in mind", async () => {
    // The browser saw sold out and asked for in stock (stock). The database says on sale: that is a sale ending.
    db.productStatus.mockResolvedValue("on_sale");
    as("products.stock");
    expect(await changeStatus(id, 3, "in_stock")).toEqual({ status: "forbidden" });
    expect(db.setProductStatus).not.toHaveBeenCalled();
  });

  it("is a conflict, with what is true now, when the status changes between the read and the write", async () => {
    as("products.stock");
    db.setProductStatus.mockResolvedValue({ status: "conflict" });
    expect(await changeStatus(id, 3, "sold_out")).toEqual({ status: "conflict", product: fresh });
    expect(db.setProductStatus).toHaveBeenCalledWith("store_a", id, 3, "in_stock", "sold_out");
  });

  it("is a conflict, writing nothing, when the product already has the status asked for", async () => {
    as("products.stock", "products.sale");
    expect(await changeStatus(id, 3, "in_stock")).toEqual({ status: "conflict", product: fresh });
    expect(db.setProductStatus).not.toHaveBeenCalled();
  });

  it("is a conflict when there is no such product", async () => {
    as("products.stock", "products.sale");
    db.productStatus.mockResolvedValue(null);
    db.productDetail.mockResolvedValue(null);
    expect(await changeStatus(id, 3, "sold_out")).toEqual({ status: "conflict", product: null });
    expect(db.setProductStatus).not.toHaveBeenCalled();
  });

  it("refuses malformed input without reading or writing", async () => {
    as("products.stock", "products.sale");
    expect(await changeStatus("nope", 3, "sold_out")).toEqual({ status: "conflict", product: null });
    expect(await changeStatus(id, 0, "sold_out")).toEqual({ status: "conflict", product: null });
    expect(await changeStatus(id, 3, "gone" as ProductStatus)).toEqual({ status: "conflict", product: null });
    expect(db.productStatus).not.toHaveBeenCalled();
    expect(db.setProductStatus).not.toHaveBeenCalled();
  });
});
