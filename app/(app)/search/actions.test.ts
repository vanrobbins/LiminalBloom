import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/lib/current-member", () => ({ requireMember: async () => ({ activeStoreId: "store_a" }) }));
vi.mock("@/lib/products/queries", () => ({ search: fake.search }));

import { runSearch } from "./actions";

beforeEach(() => fake.search.mockReset().mockResolvedValue([]));

describe("runSearch", () => {
  it("searches the session's store with the parsed input", async () => {
    await runSearch({ q: "pant", colors: ["Black"] });
    expect(fake.search).toHaveBeenCalledWith("store_a", expect.objectContaining({ q: "pant", colors: ["Black"] }));
  });

  it("refuses input it can't parse rather than browsing everything", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `Color ${i}`);
    expect(await runSearch({ q: "pant", colors: tooMany })).toBeNull();
    expect(fake.search).not.toHaveBeenCalled();
  });
});
