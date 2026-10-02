// The eight zone colours as swatches (spec §5). Selection is ringed in gold.

"use client";

import { ZONE_COLORS, type ZoneColor } from "@/lib/layout/types";

export function ZoneColorPicker({ value, onChange }: { value: ZoneColor; onChange: (color: ZoneColor) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ink">Colour</legend>
      <div className="flex flex-wrap gap-2">
        {ZONE_COLORS.map((color, i) => (
          <button
            key={color}
            type="button"
            aria-label={`Colour ${i + 1}`}
            aria-pressed={color === value}
            onClick={() => onChange(color)}
            style={{ background: `var(--${color})` }}
            className="size-11 rounded border border-line aria-pressed:outline-3 aria-pressed:outline-offset-2 aria-pressed:outline-brand"
          />
        ))}
      </div>
    </fieldset>
  );
}
