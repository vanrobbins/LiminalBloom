// Typing a cell (spec §5.3): "A4" is column A, row 4, the way every label in
// the app writes it (lib/products/location-label.ts).

export function parseCell(text: string): { col: number; row: number } | null {
  const match = text.trim().toUpperCase().match(/^([A-Z]{1,2})(\d{1,2})$/);
  if (!match) return null;
  const row = Number(match[2]) - 1;
  if (row < 0) return null;
  let col = 0;
  for (const letter of match[1]) col = col * 26 + (letter.charCodeAt(0) - 64);
  return { col: col - 1, row };
}
