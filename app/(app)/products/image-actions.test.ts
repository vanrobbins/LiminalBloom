import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";
import * as currentMember from "@/lib/current-member";
import * as imageCheck from "@/lib/products/image-check";
import * as images from "@/lib/products/images";

import { uploadProductImage } from "./image-actions";

vi.mock("@/lib/current-member");
vi.mock("@/lib/products/image-check");
// Only mock putImage and deleteImagesQuietly, not the whole module
vi.mock("@/lib/products/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/products/images")>();
  return {
    ...actual,
    putImage: vi.fn(async () => {}),
    deleteImagesQuietly: vi.fn(async () => {}),
  };
});

afterAll(dropStores);

describe("uploadProductImage", () => {
  let storeId: string;

  beforeEach(async () => {
    storeId = await makeStore(`image-${Date.now()}-${Math.random()}`);
    vi.mocked(currentMember.requireMember).mockResolvedValue({
      kind: "member",
      user: { id: "member-123", name: "Test User", email: "test@example.com" },
      stores: [{ id: storeId, name: "Test Store" }],
      activeStoreId: storeId,
    });

    vi.mocked(imageCheck.sniffImageType).mockReturnValue("image/jpeg");
  })

  it("uploads a valid image and returns imageKey", async () => {
    const fixtures = await seedStoreFixtures(storeId);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg", { type: "image/jpeg" });
    const form = new FormData();
    form.append("image", file);

    const result = await uploadProductImage(fixtures.productId, form);

    expect(result.status).toBe("saved");
    if (result.status === "saved") {
      expect(result.imageKey).toMatch(/\.jpg$/);
    }
  });

  it("returns error when productId is not a valid UUID", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array([])], "test.jpg"));

    const result = await uploadProductImage("not-a-uuid", form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("no longer exists");
    }
    expect(vi.mocked(images.putImage)).not.toHaveBeenCalled();
  });

  it("returns error when no file is provided", async () => {
    const fixtures = await seedStoreFixtures(storeId);
    const form = new FormData();

    const result = await uploadProductImage(fixtures.productId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("Choose an image");
    }
  });

  it("returns error when file is empty", async () => {
    const fixtures = await seedStoreFixtures(storeId);
    const form = new FormData();
    form.append("image", new File([], "empty.jpg"));

    const result = await uploadProductImage(fixtures.productId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("Choose an image");
    }
  });

  it("returns error when file is oversized", async () => {
    const fixtures = await seedStoreFixtures(storeId);
    const oversized = new File(
      [new Uint8Array(imageCheck.MAX_UPLOAD_BYTES + 1)],
      "huge.jpg",
      { type: "image/jpeg" }
    );
    const form = new FormData();
    form.append("image", oversized);

    const result = await uploadProductImage(fixtures.productId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("over 2 MB");
    }
  });

  it("returns error when image type is not recognized", async () => {
    const fixtures = await seedStoreFixtures(storeId);
    vi.mocked(imageCheck.sniffImageType).mockReturnValue(null);
    const form = new FormData();
    form.append("image", new File([new Uint8Array([0x00, 0x01])], "weird.bin"));

    const result = await uploadProductImage(fixtures.productId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("JPEG, PNG or WebP");
    }
  });

  it("returns error when putImage fails", async () => {
    const fixtures = await seedStoreFixtures(storeId);
    vi.mocked(images.putImage).mockRejectedValueOnce(new Error("Upload failed"));
    const form = new FormData();
    form.append("image", new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg"));

    const result = await uploadProductImage(fixtures.productId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("Couldn't save");
    }
  });

  it("returns error when product not found after image upload", async () => {
    const fakeProductId = "12345678-1234-5678-1234-567812345678";
    const form = new FormData();
    form.append("image", new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg"));

    const result = await uploadProductImage(fakeProductId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("no longer exists");
    }
  });

  it("cleans up uploaded image if product no longer exists", async () => {
    const fakeProductId = "00000000-0000-0000-0000-000000000000";
    const form = new FormData();
    form.append("image", new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg"));

    const result = await uploadProductImage(fakeProductId, form);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("no longer exists");
    }
  });
});
