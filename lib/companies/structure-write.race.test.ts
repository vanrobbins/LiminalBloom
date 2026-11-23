// A region deleted between moveStore's existence check and its update is a foreign-key error (23503) from the
// driver, nested in the ORM's own error. It is "gone" for the person, never an uncaught throw; other errors still throw.
// The database itself is stood in for: the race cannot be made to happen on demand against the real one.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db", () => ({ db: { execute: mocks.execute } }));

import { moveStore } from "./structure-write";

const ACTOR = { userId: "u", name: "Ana" };
const wrapped = (code: string) => Object.assign(new Error("Failed query"), { cause: Object.assign(new Error("db"), { code }) });

const failWith = (code: string) =>
  mocks.execute.mockImplementation(async () => {
    throw wrapped(code);
  });

beforeEach(() => {
  mocks.execute.mockReset();
});

describe("moveStore when the region goes during the move", () => {
  it("answers gone for a foreign-key violation, found in the error's cause", async () => {
    failWith("23503");
    expect(await moveStore("c", ACTOR, "s", "r")).toEqual({ status: "gone" });
  });

  it("still throws any other database error", async () => {
    failWith("57014");
    await expect(moveStore("c", ACTOR, "s", "r")).rejects.toThrow("Failed query");
  });
});
