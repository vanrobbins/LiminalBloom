import { describe, expect, it } from "vitest";

import { storeActorName } from "./actor-name";

const user = { name: "Ana Admin" };
const company = { name: "Acme" };

describe("storeActorName", () => {
  it("logs a company person acting through their company role as the company", () => {
    expect(storeActorName({ user, role: { id: "company:corporate_admin" }, company })).toBe("Acme");
  });
  it("logs a store member by name, including one who also holds a company role that is outranked", () => {
    expect(storeActorName({ user, role: { id: "0b8c-real-role" }, company: null })).toBe("Ana Admin");
    expect(storeActorName({ user, role: { id: "0b8c-real-role" }, company })).toBe("Ana Admin");
  });
  it("falls back to the name when there is no role", () => {
    expect(storeActorName({ user, role: null, company: null })).toBe("Ana Admin");
  });
});
