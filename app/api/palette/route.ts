// The command palette's index: the planograms and zones of the active store, for the browser to
// match as the person types (spec §7). A GET, not a server action: actions run one at a time per
// client and would queue behind a page's auto-save (node_modules/next/dist/docs/01-app/02-guides/
// server-actions.md). Not cached: Route Handlers are not by default (01-getting-started/15-route-handlers.md).

import { loadLayout } from "@/lib/layout/load";
import { toPaletteIndex } from "@/lib/palette/payload";
import { planogramSummaries } from "@/lib/planograms/queries";

import { PRIVATE_HEADERS, paletteMember } from "./guard";

export async function GET() {
  const guard = await paletteMember();
  if ("denied" in guard) return guard.denied;
  const { activeStoreId } = guard.member;
  const [layout, summaries] = await Promise.all([loadLayout(activeStoreId), planogramSummaries(activeStoreId)]);
  return Response.json(toPaletteIndex(layout, summaries), { headers: PRIVATE_HEADERS });
}
