import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ search: vi.fn() }));
const guard = vi.hoisted(() => ({ requireSwitchForAction: vi.fn(async () => ({ status: "ok", member: { activeStoreId: "store_a" } })) }));
vi.mock("@/lib/current-member", () => guard);
vi.mock("@/lib/products/queries", () => ({ search: fake.search }));

import { runSearch } from "./search-actions";

beforeEach(() => fake.search.mockReset().mockResolvedValue({ results: [], total: 0 }));

it("is membership only: it asks for view, and answers null without searching when refused", async () => {
  guard.requireSwitchForAction.mockResolvedValueOnce({ status: "forbidden" } as never);
  expect(await runSearch({ q: "pant" })).toBeNull();
  expect(fake.search).not.toHaveBeenCalled();
  await runSearch({ q: "pant" });
  expect(guard.requireSwitchForAction).toHaveBeenLastCalledWith("view");
});

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
