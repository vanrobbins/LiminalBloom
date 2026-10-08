// A product's photo, or its category's silhouette when it has none (spec §5.5).
// Always the store-checked route, never a Blob URL; the key changes whenever
// the image does, so the browser never shows a stale one.

"use client";

import { useState } from "react";

import { SILHOUETTE_PATHS, silhouetteFor } from "@/lib/products/silhouettes";

type ProductImageProps = {
  productId: string;
  name: string;
  categoryName: string;
  imageKey: string | null;
  size?: "sm" | "lg";
};

const SIZES = { sm: "size-12", lg: "h-48 w-40" } as const;

export function ProductImage({ productId, name, categoryName, imageKey, size = "sm" }: ProductImageProps) {
  // Remember which key failed, so a new image gets its own chance to load.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-md border border-line-subtle bg-surface`;

  if (imageKey && failedKey !== imageKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- the optimizer cannot fetch an authenticated route (spec §5.5)
      <img
        src={`/api/images/${productId}?v=${encodeURIComponent(imageKey)}`}
        alt={name}
        loading="lazy"
        onError={() => setFailedKey(imageKey)}
        className={`${box} object-cover`}
      />
    );
  }

  return (
    <svg role="img" aria-label={`${name} (no photo)`} viewBox="0 0 100 120" className={`${box} p-1`}>
      <path d={SILHOUETTE_PATHS[silhouetteFor(categoryName)]} className="fill-line" fillRule="evenodd" />
    </svg>
  );
}
