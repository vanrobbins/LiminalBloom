// Product images in the private Blob store (spec §5.4–5.5). Every path sits
// under the store's own prefix, and nothing here hands out a URL: images are
// only ever read back through /api/images/[productId], which checks the store.

import "server-only";

import { randomUUID } from "node:crypto";

import { BlobNotFoundError, del, get, head, list, put } from "@vercel/blob";

import { optionalEnv } from "@/lib/env";

// Locally the dev store's token; on Vercel the SDK falls back to the connected
// store's OIDC credentials when this is unset.
const token = () => optionalEnv("BLOB_READ_WRITE_TOKEN");

export function uploadPath(storeId: string, productId: string, extension: string): string {
  return `stores/${storeId}/products/${productId}-${randomUUID().slice(0, 8)}.${extension}`;
}

export async function putImage(path: string, body: Buffer | string, contentType: string): Promise<void> {
  await put(path, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true, token: token() });
}

export function getImage(path: string, ifNoneMatch?: string) {
  return get(path, { access: "private", ifNoneMatch, token: token() });
}

export async function imageExists(path: string): Promise<boolean> {
  try {
    await head(path, { token: token() });
    return true;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return false;
    throw error;
  }
}

export async function deleteImages(paths: readonly string[]): Promise<void> {
  if (paths.length > 0) await del([...paths], { token: token() });
}

/** For cleanups after the database has committed: an orphaned file is harmless, a failed save is not. */
export async function deleteImagesQuietly(paths: readonly string[]): Promise<void> {
  try {
    await deleteImages(paths);
  } catch (error) {
    console.warn("Could not delete product images", paths, error);
  }
}

export async function listImages(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, token: token() });
    paths.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

// Seed images are content-hashed and shared by every product with the same
// look, so a user's cleanup must never delete them; the seed run removes the
// ones nothing references.
export function withoutSeedImages(paths: readonly string[]): string[] {
  return paths.filter((path) => !(path.split("/").pop() ?? "").startsWith("seed-"));
}
