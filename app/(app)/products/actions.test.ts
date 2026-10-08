import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";
import * as currentMember from "@/lib/current-member";

import { addCategory, removeProduct, saveProduct } from "./actions";

vi.mock("@/lib/current-member");

afterAll(dropStores);

describe("server actions", () => {
  let storeId: string;

  beforeEach(async () => {
    storeId = await makeStore(`actions-${randomUUID()}`);
    vi.mocked(currentMember.requireMember).mockResolvedValue({
      kind: "member",
      user: { id: "member-123", name: "Test User", email: "test@example.com" },
      stores: [{ id: storeId, name: "Test Store" }],
      activeStoreId: storeId,
    });
  });

  describe("saveProduct", () => {
    it("creates a new product with valid input", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const result = await saveProduct(null, null, {
        name: "Test Product",
        styleNumber: "TST-001",
        categoryId: fixtures.categoryId,
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      expect(result.status).toBe("saved");
      if (result.status === "saved") {
        expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      }
    });

    it("returns invalid when schema validation fails", async () => {
      const result = await saveProduct(null, null, {
        name: "", // Empty name fails validation
        styleNumber: "TST-001",
        categoryId: "not-a-uuid",
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.errors.name).toBeDefined();
      }
    });

    it("returns invalid when productId and expectedVersion mismatch", async () => {
      // productId null but expectedVersion set
      const result1 = await saveProduct(null, 1, {
        name: "Test",
        styleNumber: "TST-001",
        categoryId: randomUUID(),
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });
      expect(result1.status).toBe("invalid");
      if (result1.status === "invalid") {
        expect(result1.errors.name).toContain("Reload");
      }

      // productId set but expectedVersion null
      const result2 = await saveProduct(randomUUID(), null, {
        name: "Test",
        styleNumber: "TST-001",
        categoryId: randomUUID(),
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });
      expect(result2.status).toBe("invalid");
    });

    it("returns conflict when productId is invalid UUID on edit", async () => {
      const result = await saveProduct("not-a-uuid", 1, {
        name: "Test",
        styleNumber: "TST-001",
        categoryId: randomUUID(),
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });
      expect(result.status).toBe("conflict");
    });

    it("returns conflict when expectedVersion is invalid on edit", async () => {
      const result = await saveProduct(randomUUID(), 0, {
        name: "Test",
        styleNumber: "TST-001",
        categoryId: randomUUID(),
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });
      expect(result.status).toBe("conflict");
    });

    it("updates a product with matching version", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const result = await saveProduct(fixtures.productId, fixtures.productVersion, {
        name: "Updated Name",
        styleNumber: fixtures.styleNumber,
        categoryId: fixtures.categoryId,
        color: "Red",
        sizeRange: "M–XXL",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      expect(result.status).toBe("saved");
    });

    it("returns conflict when version is stale on edit", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const result = await saveProduct(fixtures.productId, 999, {
        name: "Updated Name",
        styleNumber: fixtures.styleNumber,
        categoryId: fixtures.categoryId,
        color: "Red",
        sizeRange: "M–XXL",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      expect(result.status).toBe("conflict");
    });

    it("returns invalid when category no longer exists", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const result = await saveProduct(fixtures.productId, fixtures.productVersion, {
        name: "Test",
        styleNumber: fixtures.styleNumber,
        categoryId: randomUUID(), // Category doesn't exist
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.errors.categoryId).toContain("no longer exists");
      }
    });

    it("returns invalid for duplicate style number", async () => {
      const fixtures = await seedStoreFixtures(storeId);
      const duplicate = `DUP-${randomUUID().slice(0, 8)}`;

      // Create first product
      await saveProduct(null, null, {
        name: "First",
        styleNumber: duplicate,
        categoryId: fixtures.categoryId,
        color: "Blue",
        sizeRange: "S–L",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      // Try to create second with same style number
      const result = await saveProduct(null, null, {
        name: "Second",
        styleNumber: duplicate,
        categoryId: fixtures.categoryId,
        color: "Red",
        sizeRange: "M–XL",
        status: "in_stock",
        overrides: { hung: null, folded: null },
      });

      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.errors.styleNumber).toContain("already uses");
      }
    });
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
        expect(result.category.hungColumns).toBe(1);
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
        hungColumns: 1,
        hungRows: 3,
        foldedColumns: 2,
        foldedRows: 2,
        stackLimit: 8,
      });
    });
  });
});
