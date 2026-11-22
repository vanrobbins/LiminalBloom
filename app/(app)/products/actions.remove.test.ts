import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";
import { EVERYTHING, guardFor, memberWith } from "@/lib/access/test-guard";
import * as currentMember from "@/lib/current-member";

import { addCategory, removeProduct } from "./actions";

vi.mock("@/lib/current-member");

afterAll(dropStores);

describe("server actions", () => {
  let storeId: string;

  beforeEach(async () => {
    storeId = await makeStore(`actions-${randomUUID()}`);
    // Everything allowed: these tests are about what the actions do; the switch rules are in edit-actions.access.test.ts.
    vi.mocked(currentMember.requireSwitchForAction).mockImplementation(guardFor(() => memberWith(storeId, EVERYTHING.switches)));
  });

  describe("removeProduct", () => {
    it("deletes a product with matching version", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const result = await removeProduct(fixtures.productId, fixtures.productVersion);
      expect(result.status).toBe("saved");
    });

    it("returns conflict when version is stale", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const result = await removeProduct(fixtures.productId, 999);
      expect(result.status).toBe("conflict");
    });

    it("returns conflict when productId is invalid UUID", async () => {
      const result = await removeProduct("not-a-uuid", 1);
      expect(result.status).toBe("conflict");
    });

    it("returns conflict when version is invalid", async () => {
      const result = await removeProduct(randomUUID(), 0);
      expect(result.status).toBe("conflict");
    });

    it("returns conflict when product not found", async () => {
      const result = await removeProduct(randomUUID(), 1);
      expect(result.status).toBe("conflict");
    });
  });

  describe("addCategory", () => {
    it("adds a new category with valid name", async () => {
      const result = await addCategory("Knits");
      expect(result.status).toBe("saved");
      if (result.status === "saved") {
        expect(result.category.name).toBe("Knits");
        expect(result.category.hungColumns).toBe(2);
      }
    });

    it("returns invalid for empty name", async () => {
      const result = await addCategory("");
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.message).toBeDefined();
      }
    });

    it("returns invalid for duplicate category name", async () => {
      await addCategory("Denim");
      const result = await addCategory("Denim");
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.message).toContain("already a category");
      }
    });

    it("returns invalid for case-insensitive duplicate", async () => {
      await addCategory("Accessories");
      const result = await addCategory("accessories");
      expect(result.status).toBe("invalid");
    });

    it("returns saved with correct default values", async () => {
      const result = await addCategory("Outerwear");
      expect(result.status).toBe("saved");
      if (result.status !== "saved") return;

      expect(result.category).toMatchObject({
        name: "Outerwear",
        hungColumns: 2,
        hungRows: 3,
        foldedColumns: 4,
        foldedRows: 2,
      });
    });
  });
});
