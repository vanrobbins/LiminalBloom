// Columns are half a foot wide (DECISIONS 10-12); rows are levels, or feet on
// a table top. The one place that turns a column count into feet and back.

export const COLUMNS_PER_FOOT = 2;
/** 24 ft of run. */
export const MAX_COLUMNS = 48;
export const MAX_ROWS = 24;

/** 9 -> "4½", 8 -> "4", 1 -> "½". */
export function feetText(columns: number): string {
  const whole = Math.floor(columns / COLUMNS_PER_FOOT);
  if (columns % COLUMNS_PER_FOOT === 0) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

/** "4", "4.5", "4½" -> 9 half-foot columns; null for anything else. */
export function parseFeet(text: string): number | null {
  const match = text.replace(/\s+/g, "").match(/^(\d{0,2})(\.5|\.0|½)?$/);
  if (!match || (match[1] === "" && !match[2])) return null;
  const whole = match[1] === "" ? 0 : Number(match[1]);
  const half = match[2] === ".5" || match[2] === "½" ? 1 : 0;
  return whole * COLUMNS_PER_FOOT + half;
}
