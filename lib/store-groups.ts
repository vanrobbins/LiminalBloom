// The store list as the switcher shows it (spec 0.7.1b §11): a company's stores by region, then the
// standalone ones. Pure: no React, no database. A person with only standalone stores gets one group
// with no heading, so their list reads exactly as before.

export type GroupableStore = {
  id: string;
  name: string;
  companyId?: string | null;
  companyName?: string | null;
  regionName?: string | null;
};

/** `heading` is null for a region without a sub-heading (standalone stores, or the flat list). */
export type StoreRegion<T> = { heading: string | null; stores: T[] };

/** `heading` is the company's name, "Standalone", or null for the flat list. */
export type StoreGroup<T> = { heading: string | null; regions: StoreRegion<T>[] };

export const NO_REGION = "No region";
export const STANDALONE = "Standalone";

/**
 * Groups the stores in the order the switcher lists them. Named regions come first, alphabetically,
 * with their store count ("North · 4"); "No region" comes last. Standalone stores come after every
 * company. Stores keep their order within a region.
 */
export function storeGroups<T extends GroupableStore>(stores: readonly T[]): StoreGroup<T>[] {
  const companies = new Map<string, { name: string; regions: Map<string | null, T[]> }>();
  const standalone: T[] = [];

  for (const store of stores) {
    if (!store.companyId) {
      standalone.push(store);
      continue;
    }
    let company = companies.get(store.companyId);
    if (!company) {
      company = { name: store.companyName ?? "Company", regions: new Map() };
      companies.set(store.companyId, company);
    }
    const region = store.regionName ?? null;
    company.regions.set(region, [...(company.regions.get(region) ?? []), store]);
  }

  if (companies.size === 0) {
    return [{ heading: null, regions: [{ heading: null, stores: [...standalone] }] }];
  }

  const groups: StoreGroup<T>[] = [...companies.values()].map((company) => {
    const named = [...company.regions.entries()]
      .filter((entry): entry is [string, T[]] => entry[0] !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => ({ heading: `${name} · ${list.length}`, stores: list }));
    const unassigned = company.regions.get(null);
    const regions = unassigned ? [...named, { heading: NO_REGION, stores: unassigned }] : named;
    return { heading: company.name, regions };
  });

  if (standalone.length > 0) {
    groups.push({ heading: STANDALONE, regions: [{ heading: null, stores: standalone }] });
  }
  return groups;
}

/** The stores in list order, as the groups hold them: the palette's store commands use this order. */
export function flatStores<T>(groups: readonly StoreGroup<T>[]): T[] {
  return groups.flatMap((group) => group.regions.flatMap((region) => region.stores));
}
