import { describe, expect, it } from "vitest";

import { clearRecent, pushRecent, readRecent, toPick } from "./recent";
import type { PaletteItem, RecentPick } from "./types";

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}
const throwing = (): Storage =>
  new Proxy({} as Storage, {
    get: () => () => {
      throw new Error("blocked");
    },
  });

const pick = (n: number): RecentPick => ({ id: `page:/p${n}`, kind: "page", label: `Page ${n}`, href: `/p${n}` });

describe("recent picks", () => {
  it("starts empty and keeps the newest first", () => {
    const s = memory();
    expect(readRecent("u1", "s1", s)).toEqual([]);
    pushRecent("u1", "s1", pick(1), s);
    pushRecent("u1", "s1", pick(2), s);
    expect(readRecent("u1", "s1", s).map((p) => p.id)).toEqual(["page:/p2", "page:/p1"]);
  });

  it("moves a repeated pick to the front instead of listing it twice", () => {
    const s = memory();
    for (const n of [1, 2, 1]) pushRecent("u1", "s1", pick(n), s);
    expect(readRecent("u1", "s1", s).map((p) => p.id)).toEqual(["page:/p1", "page:/p2"]);
  });

  it("keeps only the last 5", () => {
    const s = memory();
    for (let n = 1; n <= 7; n++) pushRecent("u1", "s1", pick(n), s);
    expect(readRecent("u1", "s1", s).map((p) => p.label)).toEqual(["Page 7", "Page 6", "Page 5", "Page 4", "Page 3"]);
  });

  it("keeps each person's and each store's picks apart", () => {
    const s = memory();
    pushRecent("u1", "s1", pick(1), s);
    expect(readRecent("u2", "s1", s)).toEqual([]);
    expect(readRecent("u1", "s2", s)).toEqual([]);
  });

  it("is harmless when the storage throws or holds junk", () => {
    expect(readRecent("u1", "s1", throwing())).toEqual([]);
    expect(pushRecent("u1", "s1", pick(1), throwing()).map((p) => p.id)).toEqual(["page:/p1"]);
    expect(() => clearRecent(throwing())).not.toThrow();
    const s = memory();
    s.setItem("liminal-bloom:palette-recent:u1:s1", "{not json");
    expect(readRecent("u1", "s1", s)).toEqual([]);
    s.setItem("liminal-bloom:palette-recent:u1:s1", JSON.stringify([{ id: 5 }, pick(1)]));
    expect(readRecent("u1", "s1", s)).toEqual([]);
  });

  it("clears every person's and store's picks on sign-out, and nothing else", () => {
    const s = memory();
    pushRecent("u1", "s1", pick(1), s);
    pushRecent("u1", "s2", pick(2), s);
    s.setItem("theme", "dark");
    clearRecent(s);
    expect(readRecent("u1", "s1", s)).toEqual([]);
    expect(readRecent("u1", "s2", s)).toEqual([]);
    expect(s.getItem("theme")).toBe("dark");
  });
});

describe("toPick", () => {
  const base = { id: "x", label: "L", keywords: "" };
  it("keeps what has an address", () => {
    expect(toPick({ ...base, id: "planogram:1", kind: "planogram", second: "Zone · Draft", href: "/planograms/1" } as PaletteItem)).toEqual({
      id: "planogram:1", kind: "planogram", label: "L", second: "Zone · Draft", href: "/planograms/1",
    });
    expect(toPick({ ...base, kind: "page", icon: (() => null) as never, target: { href: "/store" } })).toMatchObject({ kind: "page", href: "/store" });
  });
  it("skips in-place actions and the all-products row", () => {
    expect(toPick({ ...base, kind: "action", icon: (() => null) as never, target: { theme: true } })).toBeNull();
    expect(toPick({ ...base, kind: "action", icon: (() => null) as never, target: { storeId: "s" } })).toBeNull();
    expect(toPick({ ...base, kind: "all-products", href: "/products?q=a" })).toBeNull();
  });
  it("keeps a product by its name and style number", () => {
    expect(toPick({ ...base, id: "product:9", label: "Navy Tee", kind: "product", styleNumber: "NT-1", status: "in_stock", place: null, more: 0, href: "/products?q=n&open=9" })).toEqual({
      id: "product:9", kind: "product", label: "Navy Tee", second: "NT-1", href: "/products?q=n&open=9",
    });
  });
});

describe("toPick, a recent row picked again", () => {
  it("goes back to the pick it came from, so it moves to the front", () => {
    const row: PaletteItem = { id: "recent:page:/store", label: "Store", keywords: "", kind: "recent", of: "page", href: "/store" };
    expect(toPick(row)).toEqual({ id: "page:/store", kind: "page", label: "Store", href: "/store" });
  });
});
