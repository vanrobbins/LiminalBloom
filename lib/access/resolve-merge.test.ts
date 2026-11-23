// The pure merge inside resolveAccess (spec 0.7.1, 4.2): union of switches, highest rank, the synthetic
// company role, which store is active, and the order the store list comes in. No database.

import { describe, expect, it } from "vitest";

import { companyRole } from "./company-roles";
import { mergeAccess, type CompanyGrant, type Grants, type MemberGrant, type StoreInfo } from "./resolve-merge";
import { builtinRole, type BuiltinRoleKey } from "./roles";

const standalone = (id: string, name = id): StoreInfo => ({ id, name, companyId: null, companyName: null, regionId: null, regionName: null });
const inCompany = (id: string, region: { id: string; name: string } | null, name = id): StoreInfo => ({
  id,
  name,
  companyId: "co-1",
  companyName: "Acme",
  regionId: region?.id ?? null,
  regionName: region?.name ?? null,
});

function memberOf(store: StoreInfo, builtin: BuiltinRoleKey | null, day = 1, requiresTwoFactor = false): MemberGrant {
  const r = builtin ? builtinRole(builtin) : null;
  return {
    ...store,
    joinedAt: new Date(2026, 0, day),
    role: r ? { id: `role-${r.key}`, name: r.name, rank: r.rank, builtin: r.key, stored: [...r.switches], requiresTwoFactor } : null,
  };
}

const grant = (role: CompanyGrant["role"], region: { id: string; name: string } | null = null): CompanyGrant => ({
  companyId: "co-1",
  companyName: "Acme",
  role,
  regionId: region?.id ?? null,
  regionName: region?.name ?? null,
});

const none: Grants = { members: [], company: null, companyStores: [], lastActiveStoreId: null };
const sorted = (s: Iterable<string>) => [...s].sort();

describe("mergeAccess", () => {
  it("resolves nothing for a person with no grants", () => {
    expect(mergeAccess(none, {})).toEqual({ activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false, stores: [], company: null });
  });

  it("gives a store member the role and switches of their member role, and no company", () => {
    const out = mergeAccess({ ...none, members: [memberOf(standalone("a"), "sales_associate")] }, {});
    expect(out.activeStoreId).toBe("a");
    expect(out.role).toMatchObject({ id: "role-sales_associate", builtin: "sales_associate", rank: 500 });
    expect(sorted(out.switches)).toEqual(["products.stock", "view"]);
    expect(out.company).toBeNull();
  });

  it("gives a member with no role view only", () => {
    const out = mergeAccess({ ...none, members: [memberOf(standalone("a"), null)] }, {});
    expect(out.role).toBeNull();
    expect(sorted(out.switches)).toEqual(["view"]);
  });

  it("locks the Store Manager's switches whatever was stored", () => {
    const m = memberOf(standalone("a"), "store_manager");
    const out = mergeAccess({ ...none, members: [{ ...m, role: { ...m.role!, stored: ["products.edit"] } }] }, {});
    expect(sorted(out.switches)).toEqual(["people.manage", "products.edit", "roles.manage", "store.settings", "view"]);
  });

  it("gives an owner the synthetic role and every store switch in each company store", () => {
    const out = mergeAccess({ ...none, company: grant("owner"), companyStores: [inCompany("s1", null)] }, {});
    expect(out.activeStoreId).toBe("s1");
    expect(out.role).toEqual({ id: "company:owner", name: "Owner", rank: 10, builtin: null });
    expect(sorted(out.switches)).toEqual(sorted(companyRole("owner").storeSwitches));
    expect(out.company).toEqual({ id: "co-1", name: "Acme", role: "owner", regionId: null, regionName: null, switches: ["company.settings", "company.structure", "company.people"] });
  });

  it("gives a regional manager only view and people.manage, and no company switches", () => {
    const north = { id: "r-n", name: "North" };
    const out = mergeAccess({ ...none, company: grant("regional_manager", north), companyStores: [inCompany("s1", north)] }, {});
    expect(sorted(out.switches)).toEqual(["people.manage", "view"]);
    expect(out.role?.id).toBe("company:regional_manager");
    expect(out.company).toMatchObject({ role: "regional_manager", regionId: "r-n", regionName: "North", switches: [] });
  });

  it("unions the switches of both grants and shows the higher rank", () => {
    const north = { id: "r-n", name: "North" };
    const s = inCompany("s1", north);
    const out = mergeAccess({ ...none, members: [memberOf(s, "sales_associate")], company: grant("regional_manager", north), companyStores: [s] }, {});
    expect(out.role?.id).toBe("company:regional_manager");
    expect(sorted(out.switches)).toEqual(["people.manage", "products.stock", "view"]);
  });

  it("carries requiresTwoFactor of the member role", () => {
    const a = standalone("a");
    expect(mergeAccess({ ...none, members: [memberOf(a, "store_manager", 1, true)] }, {}).requiresTwoFactor).toBe(true);
    expect(mergeAccess({ ...none, members: [memberOf(a, "vm_worker")] }, {}).requiresTwoFactor).toBe(false);
  });

  it("asks for two-factor of every company role, in a store, in a member store outside the company, and with no store at all", () => {
    const s = inCompany("s1", null);
    for (const role of ["owner", "corporate_admin", "regional_manager"] as const) {
      expect(mergeAccess({ ...none, company: grant(role), companyStores: [s] }, {}).requiresTwoFactor, role).toBe(true);
      expect(mergeAccess({ ...none, company: grant(role) }, {}).requiresTwoFactor, `${role}, no store`).toBe(true);
      expect(mergeAccess({ ...none, members: [memberOf(standalone("x"), "vm_worker")], company: grant(role), companyStores: [s] }, { activeStoreId: "x" }).requiresTwoFactor, `${role}, other store`).toBe(true);
    }
  });

  it("gives no company switch in a member store outside the company", () => {
    const out = mergeAccess({ ...none, members: [memberOf(standalone("x"), "vm_worker")], company: grant("corporate_admin"), companyStores: [inCompany("s1", null)] }, { activeStoreId: "x" });
    expect(out.activeStoreId).toBe("x");
    expect(out.role?.builtin).toBe("vm_worker");
    expect(out.switches.has("roles.manage")).toBe(false);
    expect(out.company?.role).toBe("corporate_admin");
  });
});

describe("active store order", () => {
  const a = standalone("a", "Alpha");
  const b = standalone("b", "Bravo");
  const c = inCompany("c", null, "Charlie");
  const grants: Grants = { members: [memberOf(a, "sales_associate", 5), memberOf(b, "sales_associate", 2)], company: grant("owner"), companyStores: [c], lastActiveStoreId: null };

  it("takes the session's active store first", () => {
    expect(mergeAccess({ ...grants, lastActiveStoreId: "b" }, { activeStoreId: "a", activeOrganizationId: "b" }).activeStoreId).toBe("a");
  });

  it("then the active organization of a session from before 0021", () => {
    expect(mergeAccess({ ...grants, lastActiveStoreId: "a" }, { activeStoreId: null, activeOrganizationId: "b" }).activeStoreId).toBe("b");
  });

  it("then the remembered store", () => {
    expect(mergeAccess({ ...grants, lastActiveStoreId: "a" }, {}).activeStoreId).toBe("a");
  });

  it("then the membership joined first, then the first company store by name", () => {
    expect(mergeAccess(grants, {}).activeStoreId).toBe("b");
    expect(mergeAccess({ ...grants, members: [] }, {}).activeStoreId).toBe("c");
    const two = [inCompany("z", null, "Zed"), inCompany("m", null, "Mid")];
    expect(mergeAccess({ ...none, company: grant("owner"), companyStores: two }, {}).activeStoreId).toBe("m");
  });

  it("skips a pointer that names a store the person does not reach", () => {
    expect(mergeAccess({ ...grants, lastActiveStoreId: "nil" }, { activeStoreId: "nope", activeOrganizationId: "nada" }).activeStoreId).toBe("b");
  });
});

describe("the store list", () => {
  it("lists each store once with its company and region: the person's company by region, other companies, then standalone", () => {
    const north = { id: "r-n", name: "North" };
    const south = { id: "r-s", name: "South" };
    const own = inCompany("c-n", north, "Zeta");
    const members = [
      memberOf(standalone("p", "Pioneer"), "sales_associate", 1),
      memberOf(own, "sales_associate", 2),
      memberOf({ ...inCompany("other", null, "Other"), companyId: "co-2", companyName: "Beta" }, "vm_worker", 3),
    ];
    const out = mergeAccess(
      { ...none, members, company: grant("owner"), companyStores: [own, inCompany("c-s", south, "Alpha"), inCompany("c-0", null, "Mid"), inCompany("c-n2", north, "Beta")] },
      {},
    );
    expect(out.stores.map((s) => s.id)).toEqual(["c-n2", "c-n", "c-s", "c-0", "other", "p"]);
    expect(out.stores[0]).toEqual({ id: "c-n2", name: "Beta", companyId: "co-1", companyName: "Acme", regionId: "r-n", regionName: "North" });
  });
});
