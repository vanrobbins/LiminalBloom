// The map's accessible name: what is on it, in words (spec §10). The list
// beside the map is the full route for screen readers; this is the summary.

import type { Layout } from "@/lib/layout/types";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function mapLabel(layout: Layout): string {
  return `Store layout: ${count(layout.zones.length, "zone", "zones")}, ${count(
    layout.fixtures.length,
    "fixture",
    "fixtures",
  )}, ${count(layout.entrances.length, "entrance", "entrances")}`;
}
