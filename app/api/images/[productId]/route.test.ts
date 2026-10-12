// The image route against real stores, with Blob and the session stood in:
// another store's product id must look exactly like a missing one.

import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";
import { setProductImage } from "@/lib/products/write";

const member = vi.hoisted(() => ({ current: { kind: "signed-out" } as Record<string, unknown> }));
const blob = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/current-member", () => ({ getCurrentMember: async () => member.current }));
vi.mock("@/lib/products/images", () => ({ getImage: blob.get }));

const { GET } = await import("./route");

const call = (productId: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/api/images/${productId}`, { headers }), { params: Promise.resolve({ productId }) });

afterAll(dropStores);
// Braces matter: Vitest runs a function returned from beforeEach as cleanup, and mockReset() returns the mock.
beforeEach(() => {
  blob.get.mockReset();
});

describe("GET /api/images/[productId]", () => {
  it("is 401 when signed out", async () => {
    member.current = { kind: "signed-out" };
    expect((await call(randomUUID())).status).toBe(401);
    expect(blob.get).not.toHaveBeenCalled();
  });

  it("streams this store's image with private, sandboxed headers", async () => {
    const store = await makeStore("image-route");
    const f = await seedStoreFixtures(store);
    await setProductImage(store, f.productId, "stores/x/products/a.webp");
    member.current = { kind: "member", activeStoreId: store };
    blob.get.mockResolvedValue({ statusCode: 200, stream: new Blob(["img"]).stream(), blob: { contentType: "image/webp", etag: '"e1"' } });
    const response = await call(f.productId);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(blob.get).toHaveBeenCalledWith("stores/x/products/a.webp", undefined);
  });

  it("answers 304 when the browser's copy is current", async () => {
    const store = await makeStore("image-304");
    const f = await seedStoreFixtures(store);
    await setProductImage(store, f.productId, "p/a.webp");
    member.current = { kind: "member", activeStoreId: store };
    blob.get.mockResolvedValue({ statusCode: 304, stream: null, blob: { contentType: "image/webp", etag: '"e1"' } });
    const response = await call(f.productId, { "if-none-match": '"e1"' });
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"e1"');
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(blob.get).toHaveBeenCalledWith("p/a.webp", '"e1"');
  });

  it("is 404 for another store's product, never touching Blob", async () => {
    const mine = await makeStore("image-mine");
    const theirs = await makeStore("image-theirs");
    const f = await seedStoreFixtures(theirs);
    await setProductImage(theirs, f.productId, "stores/theirs/products/secret.webp");
    member.current = { kind: "member", activeStoreId: mine };
    expect((await call(f.productId)).status).toBe(404);
    expect(blob.get).not.toHaveBeenCalled();
  });

  it("is 404 for a product without an image or a malformed id", async () => {
    const store = await makeStore("image-none");
    const f = await seedStoreFixtures(store);
    member.current = { kind: "member", activeStoreId: store };
    expect((await call(f.productId)).status).toBe(404);
    expect((await call("../../etc/passwd")).status).toBe(404);
  });

  it("is 502 when Blob fails, and logs the cause", async () => {
    const store = await makeStore("image-502");
    const f = await seedStoreFixtures(store);
    await setProductImage(store, f.productId, "p/a.webp");
    member.current = { kind: "member", activeStoreId: store };
    const cause = new Error("blob down");
    blob.get.mockRejectedValue(cause);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(f.productId)).status).toBe(502);
    expect(logged).toHaveBeenCalledWith("Could not read product image", "p/a.webp", cause);
    logged.mockRestore();
  });
});
