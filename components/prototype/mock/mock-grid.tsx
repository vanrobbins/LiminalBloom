// A fixture face on the half-foot grid, drawn: open space shows as faint
// lines, products as filled tiles. Columns are half feet; rows are rows.

export type MockTile = {
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
  /** A zone colour, 1–8: muted fills ink text reads on in both themes. */
  tone: number;
  look?: "selected" | "found" | "gap" | "new";
};

const TONES = ["", "bg-zone-1", "bg-zone-2", "bg-zone-3", "bg-zone-4", "bg-zone-5", "bg-zone-6", "bg-zone-7", "bg-zone-8"];

// A gap is the space a sold-out product leaves: brick with a dashed edge, and
// its label says so, so it reads without colour.
const GAP = "border border-dashed border-danger bg-danger-tint text-danger";

const LOOKS = {
  selected: "outline-2 outline-offset-1 outline-brand",
  found: "outline-2 outline-offset-1 outline-brand",
  new: "border border-dashed border-ink",
};

type MockGridProps = { cols: number; rows: number; tiles: MockTile[]; rowHeight?: string };

export function MockGrid({ cols, rows, tiles, rowHeight = "2.25rem" }: MockGridProps) {
  return (
    <div
      className="grid gap-0.5 rounded border border-line bg-line-subtle p-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, ${rowHeight})` }}
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <span
          key={`cell-${i}`}
          className="rounded-sm bg-surface"
          style={{ gridColumn: (i % cols) + 1, gridRow: Math.floor(i / cols) + 1 }}
        />
      ))}
      {tiles.map((tile) => (
        <span
          key={tile.label}
          className={`relative flex items-center justify-center overflow-hidden rounded-sm px-0.5 text-center text-[0.625rem] leading-tight font-medium ${tile.look === "gap" ? GAP : `text-ink ${TONES[tile.tone]} ${tile.look ? LOOKS[tile.look] : ""}`}`}
          style={{ gridColumn: `${tile.col + 1} / span ${tile.w}`, gridRow: `${tile.row + 1} / span ${tile.h}` }}
        >
          {tile.label}
        </span>
      ))}
    </div>
  );
}
