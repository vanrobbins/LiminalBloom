// How a product without a photo is drawn (Week 6.5 spec §4.5): its colour
// (the colour word's, or one picked on the wheel) and its texture, with a live
// laid-flat preview. Saved with the form. The colour word itself stays a
// required field above, since Search matches it.

"use client";

import { useId } from "react";

import { ColorWheel } from "@/components/ui/color-wheel";
import { colorWordTint, oklchToHex } from "@/lib/products/colors";
import type { Shape } from "@/lib/products/drawings";
import { TEXTURES, type Texture } from "@/lib/products/schemas";

import { ProductDrawing } from "./product-drawing";

export const TEXTURE_LABEL: Record<Texture, string> = { solid: "Solid", stripes: "Stripes", check: "Check", dots: "Dots", denim: "Denim", rib: "Rib" };

type DrawingFieldsProps = {
  shape: Shape;
  colorWord: string;
  swatch: string | null;
  texture: Texture;
  onSwatch: (swatch: string | null) => void;
  onTexture: (texture: Texture) => void;
};

const OPTION =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded border border-line px-3 text-ink has-checked:border-ink has-checked:bg-line-subtle has-focus-visible:outline-2 has-focus-visible:outline-ink";

export function DrawingFields({ shape, colorWord, swatch, texture, onSwatch, onTexture }: DrawingFieldsProps) {
  const name = useId();
  // The wheel starts from the colour word's tint, or a mid grey.
  const start = swatch ?? oklchToHex(colorWordTint(colorWord) ?? { l: 0.6, c: 0, h: 0 });
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-line-subtle p-4">
      <legend className="px-1 text-sm font-medium text-ink">Drawing (shown when there is no photo)</legend>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ProductDrawing shape={shape} view="flat" swatch={swatch} colorWord={colorWord} texture={texture} label="Preview" className="h-40 w-32 shrink-0 rounded-md border border-line-subtle bg-surface p-1" />
        <div className="flex min-w-0 flex-col gap-3">
          <div role="radiogroup" aria-label="Swatch" className="flex flex-col gap-2 sm:flex-row">
            <label className={OPTION}>
              <input type="radio" name={name} checked={swatch === null} onChange={() => onSwatch(null)} className="size-4 accent-ink" />
              Match the color word
            </label>
            <label className={OPTION}>
              <input type="radio" name={name} checked={swatch !== null} onChange={() => onSwatch(start)} className="size-4 accent-ink" />
              Pick a color
            </label>
          </div>
          {swatch !== null ? <ColorWheel value={swatch} onChange={onSwatch} label="Swatch" /> : null}
        </div>
      </div>
      <div role="group" aria-label="Texture" className="flex flex-wrap gap-2">
        {TEXTURES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={texture === t}
            onClick={() => onTexture(t)}
            className="flex min-h-11 flex-col items-center gap-1 rounded-md border border-line bg-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-brand"
          >
            <ProductDrawing shape={shape} view="flat" swatch={swatch} colorWord={colorWord} texture={t} className="h-10 w-8" />
            {TEXTURE_LABEL[t]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
