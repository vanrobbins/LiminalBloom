// A product's photo, or its drawing when it has none (spec §5.5, Week 6.5
// spec §4.6). A real photo shows everywhere, planogram tiles included; without
// one, the product is drawn in the view asked for (laid flat by default; hung
// or folded on tiles), in its swatch or colour word, with its texture.
// Always the store-checked route, never a Blob URL; the key changes whenever
// the image does, so the browser never shows a stale one.

"use client";

import { useState } from "react";

import { drawingFor, type View } from "@/lib/products/drawings";
import type { Texture } from "@/lib/products/schemas";

import { ProductDrawing } from "./product-drawing";

type ProductImageProps = {
  productId: string;
  name: string;
  categoryName: string;
  imageKey: string | null;
  view?: View;
  swatch?: string | null;
  texture?: Texture;
  colorWord?: string | null;
  size?: "sm" | "lg" | "fill";
  /** Inside a control that already names the product: hidden from screen readers. */
  decorative?: boolean;
  /** No card behind a drawing: a product hung behind it shows around the garment (hung layers). */
  clear?: boolean;
};

const SIZES = { sm: "size-12 rounded-md border border-line-subtle", lg: "h-48 w-40 rounded-md border border-line-subtle", fill: "size-full" } as const;

/**
 * The old demo seed uploaded laid-flat SVGs named `seed-…`. They count as no
 * photo, so the app draws the right view instead until the store is reseeded.
 */
export function isPhoto(imageKey: string | null): imageKey is string {
  return imageKey !== null && !imageKey.startsWith("seed-");
}

export function ProductImage({ productId, name, categoryName, imageKey, view = "flat", swatch, texture, colorWord, size = "sm", decorative = false, clear = false }: ProductImageProps) {
  // Remember which key failed, so a new image gets its own chance to load.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const box = `${SIZES[size]} shrink-0 overflow-hidden ${clear ? "" : "bg-surface"}`;

  if (isPhoto(imageKey) && failedKey !== imageKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- the optimizer cannot fetch an authenticated route (spec §5.5)
      <img
        src={`/api/images/${productId}?v=${encodeURIComponent(imageKey)}`}
        alt={decorative ? "" : name}
        loading="lazy"
        // A native image drag takes the mouse from a planogram tile's own drag
        // (ghost image, "no drop" cursor). Nothing here drags images natively.
        draggable={false}
        onError={() => setFailedKey(imageKey)}
        className={`${box} object-cover`}
      />
    );
  }

  return (
    <ProductDrawing
      shape={drawingFor(categoryName, name)}
      view={view}
      swatch={swatch}
      colorWord={colorWord}
      texture={texture}
      label={decorative ? undefined : `${name} (no photo)`}
      className={`${box} p-1`}
    />
  );
}
