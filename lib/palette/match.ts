// Matching for the groups the browser filters itself (spec §3.2): planograms, zones, pages
// and actions. Every query word must appear in the label or its keywords (AND). Whole label
// beats starts with beats a word starts with beats contains beats keywords only; ties fall
// back to natural name order, so "Rack 2" comes before "Rack 10". No typo tolerance here.

import { compareNames } from "@/lib/natural-sort";
import { normalizeQuery } from "@/lib/products/search-params";

type Matchable = { label: string; keywords?: string };

/** Higher is better; null means no match. */
export function matchScore(item: Matchable, query: string): number | null {
  const q = normalizeQuery(query);
  if (q === "") return 0;
  const words = q.split(" ");
  const text = normalizeQuery(item.label);
  const keywords = normalizeQuery(item.keywords ?? "");
  if (!words.every((w) => text.includes(w) || keywords.includes(w))) return null;
  if (text === q) return 5;
  if (text.startsWith(q)) return 4;
  const textWords = text.split(" ");
  if (words.some((w) => textWords.some((t) => t.startsWith(w)))) return 3;
  if (words.every((w) => text.includes(w))) return 2;
  return 1;
}

/** The matches, best first. An empty query keeps everything in the order given. */
export function matchAndSort<T extends Matchable>(items: readonly T[], query: string): T[] {
  if (normalizeQuery(query) === "") return [...items];
  return items
    .flatMap((item) => {
      const score = matchScore(item, query);
      return score === null ? [] : [{ item, score }];
    })
    .sort((a, b) => b.score - a.score || compareNames(a.item.label, b.item.label))
    .map((m) => m.item);
}
