// What + Add offers (spec §7): zones and entrances only from the whole-store
// view; fixtures anywhere.

import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import type { Focus } from "@/lib/layout/hit-test";
import type { AddKind } from "@/lib/layout/session-core";
import { FIXTURE_TYPES } from "@/lib/layout/types";

/** The drag data type for desktop tiles dropped on the map. */
export const TILE_TYPE = "application/x-liminal-add";

export function addOptions(focus: Focus): { kind: AddKind; label: string }[] {
  const fixtures = FIXTURE_TYPES.map((type) => ({ kind: type, label: FIXTURE_RULES[type].label }));
  return focus.kind === "overview"
    ? [{ kind: "zone", label: "Zone" }, { kind: "entrance", label: "Entrance" }, ...fixtures]
    : fixtures;
}
