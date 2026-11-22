// The fixed list of permissions a role can hold (spec 0.7, 4.1). The app checks
// these, never a role's name or id, so roles stay free to be renamed and edited.
// "Switch" is the code's word; people see "permissions". A new feature adds its
// own entry here, and the Record below fails to compile until it has its text.

export const SWITCHES = [
  "view",
  "products.stock",
  "products.sale",
  "planograms.draft",
  "planograms.publish",
  "layout.edit",
  "products.edit",
  "people.manage",
  "roles.manage",
  "store.settings",
] as const;

export type Switch = (typeof SWITCHES)[number];

/**
 * `label` names the toggle in the role editor. `can` finishes the sentence
 * "This role can ..." in the summary shown before saving, so it starts with a
 * verb and has no full stop.
 */
export const SWITCH_TEXT: Record<Switch, { label: string; can: string }> = {
  view: {
    label: "View the store",
    can: "Search products and see where they are, the store map and published planograms",
  },
  "products.stock": {
    label: "Mark sold out",
    can: "Mark a product sold out, or back in stock",
  },
  "products.sale": {
    label: "Run sales",
    can: "Put a product on sale or take it off sale",
  },
  "planograms.draft": {
    label: "Draft planograms",
    can: "Start a planogram draft or a Quick Adjust, change what is in it and discard it",
  },
  "planograms.publish": {
    label: "Publish planograms",
    can: "Publish a planogram or a Quick Adjust, revert a Quick Adjust, restore an earlier version and set due dates",
  },
  "layout.edit": {
    label: "Edit the map",
    can: "Change the store map",
  },
  "products.edit": {
    label: "Edit products",
    can: "Add, change and delete products, categories and images",
  },
  "people.manage": {
    label: "Manage people",
    can: "Invite people, change people's roles and remove people, for roles ranked below this one",
  },
  "roles.manage": {
    label: "Manage roles",
    can: "Create, change, reorder and delete roles ranked below this one, giving only permissions this role has",
  },
  "store.settings": {
    label: "Store settings",
    can: "Rename the store and change its time zone",
  },
};

export function isSwitch(value: unknown): value is Switch {
  return typeof value === "string" && (SWITCHES as readonly string[]).includes(value);
}

/**
 * Turns what the database holds into a safe set, in list order. A value this
 * version does not know (a later release's permission, a typo, junk) is
 * ignored, never an error, so an old build never locks everyone out. `view` is
 * always present: a role cannot lose it, and a missing or malformed column
 * fails closed to "view only" instead of to nothing at all.
 */
export function cleanSwitches(stored: unknown): Set<Switch> {
  const found = new Set<unknown>(Array.isArray(stored) ? stored : []);
  found.add("view");
  return new Set(SWITCHES.filter((s) => found.has(s)));
}

/** The summary lines for a set of switches, in list order. */
export function summaryLines(switches: Iterable<Switch>): string[] {
  const held = new Set(switches);
  return SWITCHES.filter((s) => held.has(s)).map((s) => SWITCH_TEXT[s].can);
}
