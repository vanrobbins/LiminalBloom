import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { COMPANY_ROLES, canAssignCompanyRole, companyActor, companyRole, isSyntheticRoleId, syntheticStoreRole, type CompanyRoleKey } from "./company-roles";
import { COMPANY_SWITCHES } from "./company-switches";
import { canActOn, canActOnCompany } from "./rank";
import { BUILTIN_ROLES } from "./roles";
import { SWITCHES, type Switch } from "./switches";

const KEYS = COMPANY_ROLES.map((r) => r.key);
// Every rank on the one ladder: company 10-30, store 100-500.
const LADDER = [...COMPANY_ROLES.map((r) => r.rank), ...BUILTIN_ROLES.map((r) => r.rank)];
// Store switches that change store data; a regional manager holds none.
const DATA: readonly Switch[] = ["products.stock", "products.sale", "planograms.draft", "planograms.publish", "layout.edit", "products.edit"];

describe("the company role table (spec 2.2)", () => {
  it("ranks Owner 10, Corporate Admin 20, Regional Manager 30, all above every store role", () => {
    expect(COMPANY_ROLES.map((r) => [r.key, r.rank])).toEqual([["owner", 10], ["corporate_admin", 20], ["regional_manager", 30]]);
    expect(Math.max(...COMPANY_ROLES.map((r) => r.rank))).toBeLessThan(Math.min(...BUILTIN_ROLES.map((r) => r.rank)));
  });

  it("gives owner and corporate admin every company switch and every store switch", () => {
    for (const key of ["owner", "corporate_admin"] as const) {
      expect([...companyRole(key).companySwitches]).toEqual([...COMPANY_SWITCHES]);
      expect([...companyRole(key).storeSwitches]).toEqual([...SWITCHES]);
    }
  });

  it("gives a regional manager no company switch and only view and people.manage in a store", () => {
    expect(companyRole("regional_manager").companySwitches).toEqual([]);
    expect([...companyRole("regional_manager").storeSwitches]).toEqual(["view", "people.manage"]);
  });

  it("a regional manager never holds a store data switch (nor roles.manage or store.settings)", () => {
    const held = new Set(companyRole("regional_manager").storeSwitches);
    for (const s of [...DATA, "roles.manage", "store.settings"] as Switch[]) expect(held.has(s)).toBe(false);
  });

  it("every role holds `view` in a store", () => {
    for (const r of COMPANY_ROLES) expect(r.storeSwitches).toContain("view");
  });

  it("is frozen, and an unknown key throws", () => {
    expect(Object.isFrozen(COMPANY_ROLES)).toBe(true);
    expect(Object.isFrozen(companyRole("owner").storeSwitches)).toBe(true);
    expect(() => companyRole("nope" as CompanyRoleKey)).toThrow();
  });
});

describe("the synthetic store role", () => {
  it("is id company:<key>, the company role's name and rank, no built-in key", () => {
    expect(syntheticStoreRole("corporate_admin")).toEqual({ id: "company:corporate_admin", name: "Corporate Admin", rank: 20, builtin: null });
    expect(syntheticStoreRole("regional_manager").rank).toBe(30);
    expect(syntheticStoreRole("owner").id).toBe("company:owner");
  });

  it("is recognised by its prefix, and a uuid never is", () => {
    for (const k of KEYS) expect(isSyntheticRoleId(syntheticStoreRole(k).id)).toBe(true);
    expect(isSyntheticRoleId(crypto.randomUUID())).toBe(false);
    expect(isSyntheticRoleId("company")).toBe(false);
  });
});

describe("canActOnCompany", () => {
  it("needs the company switch and a strictly lower rank number", () => {
    const a = { rank: 20, switches: new Set(["company.people" as const]) };
    expect(canActOnCompany(a, 30, "company.people")).toBe(true);
    expect(canActOnCompany(a, 20, "company.people")).toBe(false);
    expect(canActOnCompany(a, 10, "company.people")).toBe(false);
    expect(canActOnCompany({ rank: 20, switches: new Set() }, 30, "company.people")).toBe(false);
    expect(canActOnCompany(a, 30, "company.settings")).toBe(false);
    expect(canActOnCompany(a, NaN, "company.people")).toBe(false);
    expect(canActOnCompany({ ...a, rank: 1.5 }, 30, "company.people")).toBe(false);
  });

  it("nobody acts at or above their own rank, across both ladders", () => {
    for (const k of KEYS) {
      const a = companyActor(k);
      for (const target of LADDER) {
        for (const needs of COMPANY_SWITCHES) if (target <= a.rank) expect(canActOnCompany(a, target, needs)).toBe(false);
      }
    }
  });

  it("holds for any rank, step and switch set", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 }), fc.subarray([...COMPANY_SWITCHES]), fc.constantFrom(...COMPANY_SWITCHES), (rank, step, held, needs) =>
        !canActOnCompany({ rank, switches: new Set([...held, needs]) }, rank - step, needs),
      ),
    );
  });

  it("an owner acts on corporate admins and regional managers, a corporate admin on regional managers only, a regional manager on none", () => {
    const can = (actor: CompanyRoleKey, target: CompanyRoleKey) => canActOnCompany(companyActor(actor), companyRole(target).rank, "company.people");
    expect(KEYS.map((a) => KEYS.filter((t) => can(a, t)))).toEqual([["corporate_admin", "regional_manager"], ["regional_manager"], []]);
  });

  it("company people act on every store role, and store roles never on a company role", () => {
    for (const k of ["owner", "corporate_admin"] as const) {
      const a = { rank: companyRole(k).rank, switches: new Set<Switch>(companyRole(k).storeSwitches) };
      for (const r of BUILTIN_ROLES) expect(canActOn(a, r.rank, "people.manage")).toBe(true);
    }
    for (const r of BUILTIN_ROLES) {
      for (const c of COMPANY_ROLES) expect(canActOn({ rank: r.rank, switches: new Set(SWITCHES) }, c.rank, "people.manage")).toBe(false);
    }
  });
});

describe("canAssignCompanyRole", () => {
  it("a corporate admin cannot invite or make a corporate admin", () => {
    expect(canAssignCompanyRole("corporate_admin", "corporate_admin")).toBe(false);
    expect(canAssignCompanyRole("corporate_admin", "regional_manager")).toBe(true);
  });

  it("an owner can assign both assignable roles; nobody can assign owner", () => {
    expect(canAssignCompanyRole("owner", "corporate_admin")).toBe(true);
    expect(canAssignCompanyRole("owner", "regional_manager")).toBe(true);
    for (const k of KEYS) expect(canAssignCompanyRole(k, "owner")).toBe(false);
  });

  it("a regional manager assigns nothing", () => {
    for (const k of KEYS) expect(canAssignCompanyRole("regional_manager", k)).toBe(false);
  });

  it("nobody assigns a role at or above their own", () => {
    for (const a of KEYS) {
      for (const t of KEYS) if (companyRole(t).rank <= companyRole(a).rank) expect(canAssignCompanyRole(a, t)).toBe(false);
    }
  });
});
