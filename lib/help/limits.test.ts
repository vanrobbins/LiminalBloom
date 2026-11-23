import { describe, expect, it } from "vitest";

import { cleanBody, MAX_BODY, MAX_MESSAGES, MAX_OPEN_REQUESTS, MIN_FIRST_BODY } from "./limits";

describe("help limits (spec 0.7.1 9.2)", () => {
  it("holds the numbers Van settled: 5 open requests, 50 messages, 10 to 2000 characters to open", () => {
    expect([MAX_OPEN_REQUESTS, MAX_MESSAGES, MIN_FIRST_BODY, MAX_BODY]).toEqual([5, 50, 10, 2000]);
  });

  it("trims, and refuses a body that is too short, too long or not text", () => {
    expect(cleanBody("  twelve chars  ", MIN_FIRST_BODY)).toBe("twelve chars");
    expect(cleanBody("too short", MIN_FIRST_BODY)).toBeNull();
    expect(cleanBody("   nine    ", MIN_FIRST_BODY)).toBeNull();
    expect(cleanBody("x".repeat(MAX_BODY), MIN_FIRST_BODY)).toHaveLength(MAX_BODY);
    expect(cleanBody("x".repeat(MAX_BODY + 1), MIN_FIRST_BODY)).toBeNull();
    expect(cleanBody("ok", 1)).toBe("ok");
    expect(cleanBody("   ", 1)).toBeNull();
    for (const bad of [undefined, null, 12, {}, ["a long enough body"]]) expect(cleanBody(bad, 1)).toBeNull();
  });
});
