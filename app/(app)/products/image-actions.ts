"use server";

// Uploading a product's image (spec §5.4). The browser has already shrunk it;
// the server trusts none of that and checks membership, size and the file's
// real type before anything is stored.

import { z } from "zod";

import { requireMember } from "@/lib/current-member";
import { IMAGE_EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/products/image-check";
import { deleteImagesQuietly, putImage, uploadPath, withoutSeedImages } from "@/lib/products/images";
import { imageKeyOf } from "@/lib/products/queries";
import { setProductImage } from "@/lib/products/write";

export type UploadResult = { status: "saved"; imageKey: string } | { status: "error"; message: string };

const refuse = (message: string): UploadResult => ({ status: "error", message });

export async function uploadProductImage(productId: string, form: FormData): Promise<UploadResult> {
  const { activeStoreId } = await requireMember();
  if (!z.uuid().safeParse(productId).success) return refuse("That product no longer exists.");

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return refuse("Choose an image.");
  if (file.size > MAX_UPLOAD_BYTES) return refuse("That image is over 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return refuse("Use a JPEG, PNG or WebP image.");

  const path = uploadPath(activeStoreId, productId, IMAGE_EXTENSION[type]);
  try {
    await putImage(path, Buffer.from(bytes), type);
  } catch {
    return refuse("Couldn't save the image. Try again.");
  }

  // The product check doubles as the store check: another store's id is "not found".
  const result = await setProductImage(activeStoreId, productId, path);
  if (result.status !== "saved") {
    await deleteImagesQuietly([path]);
    return refuse("That product no longer exists.");
  }
  if (result.previous) await deleteImagesQuietly(withoutSeedImages([result.previous]));
  return { status: "saved", imageKey: imageKeyOf(path) ?? "" };
}
