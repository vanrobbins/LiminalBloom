import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { products } from "@/db/schema";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { productLooks } from "./product-looks";

afterAll(dropStores);

describe("productLooks", () => {
  it("gives each product's image key and category, in this store only", async () => {
    const a = await makeStore("looks-a");
    const fa = await seedStoreFixtures(a);
    const b = await makeStore("looks-b");
    const fb = await seedStoreFixtures(b);
    await db.update(products).set({ imagePath: `stores/${a}/products/${fa.productId}/abc123.webp` }).where(eq(products.id, fa.productId));

    const looks = await productLooks(a, [fa.productId, fb.productId]);
    expect(looks[fa.productId]).toEqual({ imageKey: "abc123.webp", categoryName: expect.any(String) });
    expect(looks[fb.productId]).toBeUndefined();
  });
});
