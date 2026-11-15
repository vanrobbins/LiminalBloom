import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { blockerFor, nestingProblem, nestingText, type NestRole } from "./nesting";
import { BUILTIN_ROLES } from "./roles";
import { SWITCHES, type Switch } from "./switches";

const role = (id: string, rank: number, switches: Switch[], was?: Switch[]): NestRole => ({ id, name: id.toUpperCase(), rank, switches, was });
const subsets = fc.subarray([...SWITCHES]);
// Distinct ranks, top first, each with its own random permissions.
const rolesArb = fc
  .array(subsets, { minLength: 1, maxLength: 6 })
  .map((all) => all.map((switches, i) => role(`r${i}`, (i + 1) * 100, switches)));

/** The rule written the long way, as the oracle: every pair, lower within higher. */
const nests = (roles: NestRole[]) =>
  roles.every((low) => roles.every((high) => high.rank >= low.rank || [...low.switches].every((s) => new Set(high.switches).has(s))));

describe("nestingProblem", () => {
  it("accepts the built-in roles as they ship", () => {
    expect(nestingProblem(BUILTIN_ROLES.map((r) => role(r.key, r.rank, [...r.switches])))).toBeNull();
  });

  it("finds a lower role holding what a higher one lacks, and names both", () => {
    const found = nestingProblem([role("a", 100, ["view"]), role("b", 200, ["view", "products.sale"])]);
    expect(found).toEqual({ role: { id: "b", name: "B" }, other: { id: "a", name: "A" }, switch: "products.sale", direction: "on" });
  });

  it("does not care what order the roles are passed in", () => {
    const roles = [role("a", 100, ["view"]), role("b", 200, ["view", "products.sale"])];
    expect(nestingProblem([...roles].reverse())).toEqual(nestingProblem(roles));
  });

  it("blames the role that gained the switch ('on') or the role that lost it ('off')", () => {
    const high = ["view", "products.sale"] as Switch[];
    const lost = nestingProblem([role("a", 100, ["view"], high), role("b", 200, ["view", "products.sale"], high)]);
    expect(lost).toMatchObject({ role: { id: "a" }, other: { id: "b" }, direction: "off" });
    const gained = nestingProblem([role("a", 100, ["view"], ["view"]), role("b", 200, ["view", "products.sale"], ["view"])]);
    expect(gained).toMatchObject({ role: { id: "b" }, other: { id: "a" }, direction: "on" });
  });

  it("ignores a mismatch between two untouched roles", () => {
    const same = ["view", "products.sale"] as Switch[];
    expect(nestingProblem([role("a", 100, ["view"], ["view"]), role("b", 200, same, same)])).toBeNull();
  });

  it("counts every switch of a role with no baseline (new or moved)", () => {
    const same = ["view", "products.sale"] as Switch[];
    expect(nestingProblem([role("a", 100, ["view"], ["view"]), role("b", 200, same)])).not.toBeNull();
  });

  it("agrees with the long-hand rule for any roles", () => {
    fc.assert(fc.property(rolesArb, (roles) => (nestingProblem(roles) === null) === nests(roles)));
  });

  it("when it names a problem, the named role really holds what the other lacks", () => {
    fc.assert(
      fc.property(rolesArb, (roles) => {
        const found = nestingProblem(roles);
        if (!found) return true;
        const by = (id: string) => roles.find((r) => r.id === id)!;
        const [lo, hi] = [by(found.role.id), by(found.other.id)];
        const [lower, higher] = lo.rank > hi.rank ? [lo, hi] : [hi, lo];
        return new Set(lower.switches).has(found.switch) && !new Set(higher.switches).has(found.switch);
      }),
    );
  });
});

describe("blockerFor", () => {
  it("names the highest role lacking the permission when turning it on, and the lowest holding it when turning it off", () => {
    const roles = [role("a", 100, ["view"]), role("b", 200, ["view"]), role("c", 300, ["view", "products.sale"]), role("d", 400, ["view", "products.sale"])];
    expect(blockerFor(roles, "d", "products.sale", true)).toEqual({ id: "a", name: "A" });
    expect(blockerFor(roles, "a", "products.sale", false)).toEqual({ id: "d", name: "D" });
    expect(blockerFor(roles, "b", "products.sale", true)).toEqual({ id: "a", name: "A" });
    expect(blockerFor(roles, "a", "products.sale", true)).toBeNull();
    expect(blockerFor(roles, "d", "products.sale", false)).toBeNull();
    expect(blockerFor(roles, "nobody", "products.sale", true)).toBeNull();
  });

  it("is null exactly when flipping that cell in a nesting set of roles still nests (property)", () => {
    const flip = (roles: NestRole[], id: string, s: Switch, on: boolean) =>
      roles.map((r) => (r.id === id ? { ...r, switches: on ? [...r.switches, s] : [...r.switches].filter((x) => x !== s) } : r));
    fc.assert(
      fc.property(rolesArb, fc.nat(5), fc.constantFrom(...SWITCHES), (roles, pick, s) => {
        if (!nests(roles)) return true;
        const target = roles[pick % roles.length];
        const turningOn = !new Set(target.switches).has(s);
        return (blockerFor(roles, target.id, s, turningOn) === null) === nests(flip(roles, target.id, s, turningOn));
      }),
    );
  });
});

describe("nestingText", () => {
  const problem = (direction: "on" | "off") => ({ role: { id: "e", name: "Educator" }, other: { id: "s", name: "Sales Associate" }, switch: "products.sale" as Switch, direction });
  it("reads as the design's examples", () => {
    expect(nestingText(problem("on"))).toBe("Sales Associate can't run sales, so Educator can't either.");
    expect(nestingText(problem("off"))).toBe("Sales Associate can still run sales; turn it off there first.");
    expect(nestingText(problem("off"), true)).toContain("Educator must be able to as well");
  });
});
