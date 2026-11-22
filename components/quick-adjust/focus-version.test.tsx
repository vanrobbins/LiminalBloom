import { afterEach, describe, expect, it, vi } from "vitest";

import { takeVersionFocus, wantVersionFocus } from "./focus-version";

afterEach(() => vi.useRealTimers());

describe("version focus request", () => {
  it("is granted once, to whoever asks first", () => {
    expect(takeVersionFocus()).toBe(false);
    wantVersionFocus();
    expect(takeVersionFocus()).toBe(true);
    expect(takeVersionFocus()).toBe(false);
  });

  it("expires, so a page with no version line can't claim it later", () => {
    vi.useFakeTimers();
    wantVersionFocus();
    vi.advanceTimersByTime(6000);
    expect(takeVersionFocus()).toBe(false);
  });
});
