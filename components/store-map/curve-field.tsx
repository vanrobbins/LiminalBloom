// A wall bay's curve without dragging (curved wall bays spec §4): how deep, and
// which way. The sign lives in the button, so the field stays in plain lengths.

"use client";

import { Button } from "@/components/ui/button";
import { FeetInchesInput } from "@/components/ui/feet-inches-input";
import { maxCurve } from "@/lib/layout/curves";
import type { Fixture } from "@/lib/layout/types";

type CurveFieldProps = { fixture: Fixture; onChange: (curve: number) => void };

export function CurveField({ fixture, onChange }: CurveFieldProps) {
  const { curve } = fixture;
  const sign = curve < 0 ? -1 : 1;
  return (
    <div className="flex flex-col gap-2">
      <FeetInchesInput
        key={`c:${fixture.id}:${curve}`}
        label="Curve"
        value={Math.abs(curve)}
        min={0}
        max={maxCurve(fixture.width, fixture.depth)}
        onCommit={(inches) => onChange(inches * sign)}
      />
      {curve !== 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">Bends toward the {curve > 0 ? "front" : "back"}</p>
          <Button variant="secondary" onClick={() => onChange(-curve)}>
            Flip curve
          </Button>
        </div>
      ) : null}
    </div>
  );
}
