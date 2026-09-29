// Tests for environment variable reading.
//
// Written after a Vercel build failed with `Invalid URL` on a value ending in
// "\n": a connection string pasted into a dashboard field had picked up a
// trailing line break. Copying a value out of a terminal or a docs page
// commonly brings whitespace with it, and the resulting failures point at the
// code that used the value rather than the value itself.

import { afterEach, describe, expect, it } from "vitest";

import { optionalEnv, requiredEnv } from "./env";

const KEY = "LIMINAL_BLOOM_TEST_VAR";

afterEach(() => {
  delete process.env[KEY];
});

describe("requiredEnv", () => {
  it("returns the value when it is set", () => {
    process.env[KEY] = "https://example.com";
    expect(requiredEnv(KEY)).toBe("https://example.com");
  });

  it("strips a trailing newline, the paste error that broke the build", () => {
    process.env[KEY] = "https://example.com\n";
    expect(requiredEnv(KEY)).toBe("https://example.com");
  });

  it("strips surrounding whitespace", () => {
    process.env[KEY] = "  https://example.com\t ";
    expect(requiredEnv(KEY)).toBe("https://example.com");
  });

  it("strips surrounding double quotes, which some dashboards keep", () => {
    process.env[KEY] = '"https://example.com"';
    expect(requiredEnv(KEY)).toBe("https://example.com");
  });

  it("leaves quotes that are part of the value alone", () => {
    process.env[KEY] = 'say "hello"';
    expect(requiredEnv(KEY)).toBe('say "hello"');
  });

  it("throws, naming the variable, when it is missing", () => {
    expect(() => requiredEnv(KEY)).toThrow(KEY);
  });

  it("treats a whitespace-only value as missing", () => {
    // An empty dashboard field that someone pressed space in is not a value.
    process.env[KEY] = "   ";
    expect(() => requiredEnv(KEY)).toThrow(KEY);
  });
});

describe("optionalEnv", () => {
  it("returns undefined when not set, rather than throwing", () => {
    expect(optionalEnv(KEY)).toBeUndefined();
  });

  it("cleans the value the same way when it is set", () => {
    process.env[KEY] = ' "https://example.com" \n';
    expect(optionalEnv(KEY)).toBe("https://example.com");
  });
});
