// The palette's product answer: the top 5 matches for `?q=` and how many there are in all. The same
// trigram search Products runs. Only for a text query (2+ characters with a letter or digit); anything
// else gets an empty answer without touching the database.

import { z } from "zod";

import { can } from "@/lib/current-member";
import { toPaletteProducts } from "@/lib/palette/payload";
import { search } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";
import { isTextQuery, normalizeQuery } from "@/lib/products/search-params";

import { PRIVATE_HEADERS, paletteMember } from "../guard";

const PALETTE_LIMIT = 5;
const queryParam = z.string().max(80);

export async function GET(request: Request) {
  const guard = await paletteMember();
  if ("denied" in guard) return guard.denied;
  const parsed = queryParam.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) return new Response(null, { status: 400, headers: PRIVATE_HEADERS });
  const q = parsed.data;
  if (!isTextQuery(normalizeQuery(q))) return Response.json({ products: [], total: 0 }, { headers: PRIVATE_HEADERS });
  const page = await search(guard.member.activeStoreId, searchInput.parse({ q }), PALETTE_LIMIT);
  return Response.json(toPaletteProducts(page, { adjust: can(guard.member, "planograms.draft") }), { headers: PRIVATE_HEADERS });
}
