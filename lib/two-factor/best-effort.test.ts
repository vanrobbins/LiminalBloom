import { describe, expect, it, vi } from "vitest";

import { bestEffort } from "./best-effort";

describe("bestEffort (a follow-up step never fails the change, and never skips the next)", () => {
  it("swallows a failure, logs it, and lets the next step run", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const after = vi.fn(async () => undefined);
    await bestEffort("first", async () => {
      throw new Error("boom");
    });
    await bestEffort("second", after);
    expect(after).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
