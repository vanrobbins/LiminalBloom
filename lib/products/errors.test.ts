import { describe, expect, it } from "vitest";

import { databaseError } from "./errors";

describe("databaseError", () => {
  it("finds the code and constraint anywhere in the cause chain", () => {
    const driver = Object.assign(new Error("duplicate key"), { code: "23505", constraint: "products_style_unique" });
    const wrapped = new Error("Failed query", { cause: driver });
    expect(databaseError(wrapped)).toEqual({ code: "23505", constraint: "products_style_unique", message: "duplicate key" });
  });

  it("returns null for errors that did not come from the database", () => {
    expect(databaseError(new Error("network"))).toBeNull();
  });

  it("returns null for errors with unknown error codes", () => {
    const unknown = Object.assign(new Error("unknown error"), { code: "UNKNOWN_CODE" });
    expect(databaseError(unknown)).toBeNull();
  });

  it("recognizes common Postgres error codes", () => {
    const unique = Object.assign(new Error("duplicate key"), { code: "23505" });
    expect(databaseError(unique)).not.toBeNull();

    const checkViolation = Object.assign(new Error("check violation"), { code: "23514" });
    expect(databaseError(checkViolation)).not.toBeNull();

    const fk = Object.assign(new Error("foreign key"), { code: "23503" });
    expect(databaseError(fk)).not.toBeNull();
  });
});
