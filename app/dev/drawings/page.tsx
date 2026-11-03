// A review page for the product drawings (Week 6.5 spec §7): every shape in
// every view, neutral and tinted, in light and dark side by side. Dev only:
// production answers 404, and nothing links here.

import { notFound } from "next/navigation";

import { ProductDrawing } from "@/components/products/product-drawing";
import { SHAPES, VIEWS } from "@/lib/products/drawings";
import type { Texture } from "@/lib/products/schemas";

const SAMPLES: { label: string; colorWord?: string; swatch?: string; texture?: Texture }[] = [
  { label: "Neutral" },
  { label: "Black", colorWord: "Black" },
  { label: "Ivory", colorWord: "Ivory" },
  { label: "Denim", colorWord: "Indigo", texture: "denim" },
  { label: "Stripes", colorWord: "Navy", texture: "stripes" },
  { label: "Rib", colorWord: "Heather Grey", texture: "rib" },
];

function Sheet() {
  return (
    <div className="flex flex-col gap-6 bg-surface p-4 text-ink">
      {SHAPES.map((shape) => (
        <section key={shape} className="flex flex-col gap-2">
          <h2 className="font-semibold">{shape}</h2>
          <div className="flex flex-wrap gap-4">
            {VIEWS.map((view) => (
              <figure key={view} className="flex flex-col items-center gap-1">
                <div className="flex gap-1">
                  {SAMPLES.map((s) => (
                    <ProductDrawing key={s.label} shape={shape} view={view} colorWord={s.colorWord} swatch={s.swatch} texture={s.texture} className="h-20 w-16 rounded border border-line-subtle bg-raised p-1" />
                  ))}
                </div>
                <figcaption className="text-xs text-ink-muted">{view}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function DrawingsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="grid gap-4 p-4 xl:grid-cols-2">
      <div>
        <p className="mb-2 text-sm">Light · {SAMPLES.map((s) => s.label).join(", ")}</p>
        <Sheet />
      </div>
      <div className="dark">
        <p className="mb-2 text-sm text-ink">Dark</p>
        <Sheet />
      </div>
    </main>
  );
}
