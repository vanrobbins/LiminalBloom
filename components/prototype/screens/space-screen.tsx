// The product form's new sections: space in words with a drawing,
// inherited from the category, size chips, swatch and texture.

import { Marker } from "../marker";
import { MockGrid } from "../mock/mock-grid";
import { MockScreen } from "../mock/mock-screen";

const SIZES = ["XS–XL", "S–XXL", "0–14", "24–34", "One size"];
const SWATCHES = ["bg-zone-2", "bg-zone-3", "bg-zone-4", "bg-zone-1", "bg-ink"];

export function SpaceScreen() {
  return (
    <MockScreen title="Linen tee" tab="products">
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-raised p-3">
        <span className="flex items-center justify-between text-sm font-semibold text-ink">
          Space on the fixture <span className="font-normal text-ink-muted">ⓘ</span>
        </span>
        <span className="flex items-start gap-2 text-xs text-ink">
          <span className="flex-1">
            <span className="block">Hung: 1½ ft wide, 2 rows high</span>
            <span className="block">Folded: 1 ft by 1 ft</span>
          </span>
          <Marker n={1} />
        </span>
        <span className="flex items-center gap-2">
          <span className="flex-1">
            <MockGrid cols={8} rows={2} rowHeight="1.5rem" tiles={[{ label: "Hung", col: 0, row: 0, w: 3, h: 2, tone: 4, look: "selected" }, { label: "Folded", col: 5, row: 1, w: 2, h: 1, tone: 4 }]} />
          </span>
          <Marker n={2} />
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="flex flex-1 flex-col gap-1">
            <span className="flex items-center gap-2 text-ink">
              <span aria-hidden="true" className="size-3.5 rounded-full border-4 border-brand" />
              Uses the Knit tops category&apos;s
            </span>
            <span className="flex items-center gap-2 text-ink-muted">
              <span aria-hidden="true" className="size-3.5 rounded-full border border-line" />
              Different for this product
            </span>
          </span>
          <Marker n={3} />
        </span>
      </section>
      <section className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-sm font-semibold text-ink">
          Sizes <Marker n={4} />
        </span>
        <span className="flex flex-wrap gap-1.5">
          {SIZES.map((size) => (
            <span key={size} className={`rounded-full border px-2.5 py-1 text-xs ${size === "XS–XL" ? "border-brand bg-brand font-semibold text-on-brand" : "border-line text-ink"}`}>
              {size}
            </span>
          ))}
        </span>
      </section>
      <section className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-sm font-semibold text-ink">
          Colour and texture <Marker n={5} />
        </span>
        <span className="flex items-center gap-2">
          {SWATCHES.map((swatch, i) => (
            <span key={swatch} aria-hidden="true" className={`size-7 rounded-full border border-line ${swatch} ${i === 2 ? "outline-2 outline-offset-2 outline-ink" : ""}`} />
          ))}
          <span className="ml-auto text-xs text-ink-muted">Texture: Rib</span>
        </span>
      </section>
    </MockScreen>
  );
}
