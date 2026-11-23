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

/**
 * `heading` is null for a region without a sub-heading (standalone stores, or the flat list).
 * `key` is stable across renders and unique within its list: React keys and the screen-reader ids use it.
 */
export type StoreRegion<T> = {
  key: string;
  heading: string | null;
  stores: T[];
};

/**
 * `heading` is the company's name, "Standalone", or null for the flat list. `key` is the company's id,
 * "standalone", or "flat".
 */
export type StoreGroup<T> = {
  key: string;
  heading: string | null;
  regions: StoreRegion<T>[];
};

export const NO_REGION = "No region";
export const STANDALONE = "Standalone";

/**
 * Groups the stores in the order the switcher lists them. Companies come alphabetically by name. Within
 * a company, named regions come first, alphabetically, with their store count ("North · 4"); "No region"
 * comes last. Standalone stores come after every company. Stores keep their order within a region.
 */
export function storeGroups<T extends GroupableStore>(
  stores: readonly T[],
): StoreGroup<T>[] {
  const companies = new Map<
    string,
    { id: string; name: string; regions: Map<string | null, T[]> }
  >();
  const standalone: T[] = [];

  for (const store of stores) {
    if (!store.companyId) {
      standalone.push(store);
      continue;
    }
    let company = companies.get(store.companyId);
    if (!company) {
      company = {
        id: store.companyId,
        name: store.companyName ?? "Company",
        regions: new Map(),
      };
      companies.set(store.companyId, company);
    }
    const region = store.regionName ?? null;
    company.regions.set(region, [
      ...(company.regions.get(region) ?? []),
      store,
    ]);
  }

  if (companies.size === 0) {
    return [
      {
        key: "flat",
        heading: null,
        regions: [{ key: "flat", heading: null, stores: [...standalone] }],
      },
    ];
  }

  const groups: StoreGroup<T>[] = [...companies.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((company) => {
      const named = [...company.regions.entries()]
        .filter((entry): entry is [string, T[]] => entry[0] !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, list]) => ({
          key: `${company.id}:${name}`,
          heading: `${name} · ${list.length}`,
          stores: list,
        }));
      const unassigned = company.regions.get(null);
      const regions = unassigned
        ? [
            ...named,
            {
              key: `no-region:${company.id}`,
              heading: NO_REGION,
              stores: unassigned,
            },
          ]
        : named;
      return { key: company.id, heading: company.name, regions };
    });

  if (standalone.length > 0) {
    groups.push({
      key: "standalone",
      heading: STANDALONE,
      regions: [{ key: "standalone", heading: null, stores: standalone }],
    });
  }
  return groups;
}

/** The stores in list order, as the groups hold them: the palette's store commands use this order. */
export function flatStores<T>(groups: readonly StoreGroup<T>[]): T[] {
  return groups.flatMap((group) =>
    group.regions.flatMap((region) => region.stores),
  );
}
