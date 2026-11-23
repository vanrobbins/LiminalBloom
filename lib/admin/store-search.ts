// The stores page's name search (`?q=`): trimmed, capped, and made safe to sit inside an ILIKE pattern.

export const MAX_STORE_QUERY = 100;

type Raw = Record<string, string | string[] | undefined>;

/** The search text from the URL: the first `q`, trimmed, at most 100 characters; "" when there is none. */
export function storeQuery(raw: Raw): string {
  const v = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  return (v ?? "").trim().slice(0, MAX_STORE_QUERY);
}

/** `%`, `_` and `\` mean themselves, not "anything". */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
