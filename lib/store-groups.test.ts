import { describe, expect, it } from "vitest";

import { flatStores, storeGroups } from "./store-groups";

const standalone = (id: string, name: string) => ({ id, name, companyId: null, companyName: null, regionName: null });
const company = (id: string, name: string, companyId = "co-1", companyName = "Acme Coffee") => ({
  id,
  name,
  companyId,
  companyName,
  regionName: null as string | null,
});
const inRegion = (id: string, name: string, regionName: string | null, companyId = "co-1") => ({ ...company(id, name, companyId), regionName });

const headings = (groups: ReturnType<typeof storeGroups>) => groups.map((g) => [g.heading, ...g.regions.map((r) => r.heading)]);

describe("storeGroups", () => {
  it("leaves a person with only standalone stores as one flat list with no heading", () => {
    const stores = [standalone("a", "Pioneer Place"), standalone("b", "Washington Square")];
    const groups = storeGroups(stores);
    expect(groups).toEqual([{ heading: null, regions: [{ heading: null, stores }] }]);
    expect(flatStores(groups)).toEqual(stores);
  });

  it("lists no groups for a person with no stores", () => {
    expect(flatStores(storeGroups([]))).toEqual([]);
  });

  it("groups a company's stores by region with counts, No region last, then Standalone", () => {
    const stores = [
      inRegion("c", "Lakeview", null),
      inRegion("a", "Pioneer Place", "North"),
      standalone("s", "Corner Cafe"),
      inRegion("b", "Ballard", "North"),
      inRegion("d", "Downtown", "Central"),
    ];
    const groups = storeGroups(stores);
    expect(headings(groups)).toEqual([
      ["Acme Coffee", "Central · 1", "North · 2", "No region"],
      ["Standalone", null],
    ]);
    expect(groups[0].regions[1].stores.map((s) => s.id)).toEqual(["a", "b"]);
    expect(groups[1].regions[0].stores.map((s) => s.id)).toEqual(["s"]);
  });

  it("gives a company with no standalone stores its heading and no Standalone group", () => {
    const groups = storeGroups([inRegion("a", "Pioneer Place", "North")]);
    expect(headings(groups)).toEqual([["Acme Coffee", "North · 1"]]);
  });

  it("keeps the flat order of the groups, so the palette and the switcher agree", () => {
    const stores = [standalone("s", "Corner Cafe"), inRegion("b", "Ballard", "North"), inRegion("a", "Pioneer Place", "North")];
    expect(flatStores(storeGroups(stores)).map((s) => s.id)).toEqual(["b", "a", "s"]);
  });
});
