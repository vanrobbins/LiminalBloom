// Search lives in the URL (spec §7.2) so Back and refresh keep it. Anything
// unreadable in a URL is dropped rather than failing the page.

import { z } from "zod";

import { MAX_FILTER_CHOICES, PLACES, PRODUCT_STATUSES, SORTS, type SearchInput, type Sort } from "./schemas";

type Params = Record<string, string | string[] | undefined>;

const all = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const unique = <T>(values: T[]) => [...new Set(values)].slice(0, 3);
const keep = <T>(values: string[], schema: z.ZodType<T>) => values.flatMap((v) => (schema.safeParse(v).success ? [v as T] : []));

export function fromSearchParams(params: Params): SearchInput {
  return {
    q: (all(params.q)[0] ?? "").slice(0, 80),
    categoryIds: keep(all(params.category), z.uuid()).slice(0, MAX_FILTER_CHOICES),
    colors: all(params.color).map((c) => c.slice(0, 40)).slice(0, MAX_FILTER_CHOICES),
    statuses: unique(keep(all(params.status), z.enum(PRODUCT_STATUSES))),
    places: unique(keep(all(params.place), z.enum(PLACES))),
    sort: keep(all(params.sort), z.enum(SORTS))[0],
    offset: 0,
  };
}

export function toSearchParams(input: SearchInput): URLSearchParams {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  for (const id of input.categoryIds) params.append("category", id);
  for (const color of input.colors) params.append("color", color);
  for (const status of input.statuses) params.append("status", status);
  for (const place of input.places) params.append("place", place);
  if (input.sort) params.set("sort", input.sort);
  return params;
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Fewer than two characters, or no letter or digit, browses instead. */
export function isTextQuery(q: string): boolean {
  return q.length >= 2 && /[\p{L}\p{N}]/u.test(q);
}

/** The order a search really uses: Best match needs text, so without it the default (Name A–Z) wins. */
export function effectiveSort(input: Pick<SearchInput, "q" | "sort">): Sort {
  const isText = isTextQuery(normalizeQuery(input.q));
  if (input.sort === undefined) return isText ? "match" : "name";
  return input.sort === "match" && !isText ? "name" : input.sort;
}

/** "60 of 470 products" while Show more has more, else "2 products" (P3.3). */
export function resultCount(shown: number, total: number): string {
  const noun = total === 1 ? "product" : "products";
  const all = total.toLocaleString("en-US");
  return shown < total ? `${shown} of ${all} ${noun}` : `${all} ${noun}`;
}

export function hasFilters(input: SearchInput): boolean {
  return input.categoryIds.length + input.colors.length + input.statuses.length + input.places.length > 0;
}
