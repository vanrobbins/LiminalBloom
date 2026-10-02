// A fixture's name, size, rotation, display sides and lower tables. Every
// field works without dragging (spec §10).

"use client";

import { Button } from "@/components/ui/button";
import { FeetInchesInput } from "@/components/ui/feet-inches-input";
import { NumberField } from "@/components/ui/number-field";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { MAX_FIXTURE_SIZE, MIN_FIXTURE_SIZE } from "@/lib/layout/limits";
import type { SessionAction } from "@/lib/layout/session";
import type { Fixture, Layout } from "@/lib/layout/types";

import { FaceSettings } from "./face-settings";
import { LowerTables } from "./lower-tables";
import { NameField } from "./name-field";

type FixturePropertiesProps = { layout: Layout; fixture: Fixture; dispatch: (action: SessionAction) => void };

export function FixtureProperties({ layout, fixture, dispatch }: FixturePropertiesProps) {
  const rule = FIXTURE_RULES[fixture.type];
  const isLower = fixture.tableSetId !== null;
  const set = layout.tableSets.find((s) => s.upperFixtureId === fixture.id);
  const lowers = set ? layout.fixtures.filter((f) => f.tableSetId === set.id) : [];
  const upperId = layout.tableSets.find((s) => s.id === fixture.tableSetId)?.upperFixtureId;
  const upper = layout.fixtures.find((f) => f.id === upperId);
  const faces = layout.faces.filter((face) => face.fixtureId === fixture.id);
  const update = (changes: Partial<Pick<Fixture, "name" | "width" | "depth" | "rotation">>) =>
    dispatch({ type: "command", command: { type: "updateFixture", id: fixture.id, changes } });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{fixture.name}</h2>
        <p className="text-sm text-ink-muted">
          {rule.label}
          {upper ? ` · part of ${upper.name}` : ""}
        </p>
      </div>
      {!isLower ? (
        <NameField key={`${fixture.id}:${fixture.name}`} label="Fixture name" value={fixture.name} onCommit={(name) => update({ name })} />
      ) : null}
      <FeetInchesInput
        key={`w:${fixture.id}:${fixture.width}`}
        label={isLower ? "Length" : "Width"}
        value={fixture.width}
        min={MIN_FIXTURE_SIZE}
        max={MAX_FIXTURE_SIZE}
        onCommit={(width) => update({ width })}
      />
      <FeetInchesInput
        key={`d:${fixture.id}:${fixture.depth}`}
        label="Depth"
        value={fixture.depth}
        min={MIN_FIXTURE_SIZE}
        max={MAX_FIXTURE_SIZE}
        onCommit={(depth) => update({ depth })}
      />
      {!isLower ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <NumberField
              key={`r:${fixture.id}:${fixture.rotation}`}
              label="Rotation"
              value={fixture.rotation}
              min={0}
              max={359}
              suffix="°"
              onCommit={(rotation) => update({ rotation })}
            />
          </div>
          <Button variant="secondary" onClick={() => update({ rotation: fixture.rotation + 90 })}>
            Rotate 90°
          </Button>
        </div>
      ) : null}
      {rule.faces.length > 0 ? <FaceSettings fixture={fixture} faces={faces} dispatch={dispatch} /> : null}
      {fixture.type === "table" && !isLower ? <LowerTables table={fixture} lowers={lowers} dispatch={dispatch} /> : null}
      <div className="flex flex-wrap gap-2">
        {!isLower ? (
          <Button variant="secondary" onClick={() => dispatch({ type: "duplicate" })}>
            Duplicate
          </Button>
        ) : null}
        <Button variant="danger" onClick={() => dispatch({ type: "command", command: { type: "delete", ids: [fixture.id] } })}>
          {isLower ? "Remove lower table" : "Delete"}
        </Button>
      </div>
    </div>
  );
}
