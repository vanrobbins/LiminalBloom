// What the read-only map shows about a tapped fixture: its kind, size, and
// the sides it displays on (spec §10).

import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { SIDE_LABEL, formatLength } from "@/lib/layout/format";
import type { Layout } from "@/lib/layout/types";

export function FixtureDetails({ layout, fixtureId }: { layout: Layout; fixtureId: string }) {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return null;
  const faces = layout.faces.filter((face) => face.fixtureId === fixture.id);
  const zone = layout.zones.find((z) => z.id === fixture.zoneId);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-ink-muted">Type</dt>
      <dd className="text-ink">{FIXTURE_RULES[fixture.type].label}</dd>
      <dt className="text-ink-muted">Size</dt>
      <dd className="text-ink">
        {formatLength(fixture.width)} × {formatLength(fixture.depth)}
      </dd>
      <dt className="text-ink-muted">Zone</dt>
      <dd className="text-ink">{zone?.name ?? "Store floor"}</dd>
      {faces.map((face) => (
        <div key={face.id} className="contents">
          <dt className="text-ink-muted">{SIDE_LABEL[face.side]}</dt>
          <dd className="text-ink">
            {face.columns} × {face.rows} grid
          </dd>
        </div>
      ))}
    </dl>
  );
}
