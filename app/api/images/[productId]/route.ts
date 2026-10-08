// Product images, only for members of the product's store (spec §5.5). The
// product is looked up inside withStore, so another store's id finds nothing
// and gets the same 404 as a missing one. Never cached by the CDN: the check
// must run for every viewer (Vercel's private storage guide).

import { z } from "zod";

import { getCurrentMember } from "@/lib/current-member";
import { getImage } from "@/lib/products/images";
import { productImagePath } from "@/lib/products/queries";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
  // The seed's SVGs are drawn by us, but an image response should never run script.
  "Content-Security-Policy": "sandbox",
};

export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const member = await getCurrentMember();
  if (member.kind !== "member") return new Response(null, { status: 401 });
  if (!z.uuid().safeParse(productId).success) return new Response(null, { status: 404 });

  const path = await productImagePath(member.activeStoreId, productId);
  if (!path) return new Response(null, { status: 404 });

  let result: Awaited<ReturnType<typeof getImage>>;
  try {
    result = await getImage(path, request.headers.get("if-none-match") ?? undefined);
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!result) return new Response(null, { status: 404 });
  if (result.statusCode === 304) {
    return new Response(null, { status: 304, headers: { ...PRIVATE_HEADERS, ETag: result.blob.etag } });
  }
  return new Response(result.stream, {
    headers: { ...PRIVATE_HEADERS, "Content-Type": result.blob.contentType, ETag: result.blob.etag },
  });
}
