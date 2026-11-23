// The fixed list of permissions the company screens check (spec 0.7.1, 2.2).
// Store switches live in switches.ts and are untouched. Company roles are fixed
// bundles in code (company-roles.ts), so the app checks these and never a
// role's name. People see "permissions", as in the role editor.

export const COMPANY_SWITCHES = ["company.settings", "company.structure", "company.people"] as const;

export type CompanySwitch = (typeof COMPANY_SWITCHES)[number];

/** `label` names the permission; `can` finishes "This role can ..." (a verb first, no full stop). */
export const COMPANY_SWITCH_TEXT: Record<CompanySwitch, { label: string; can: string }> = {
  "company.settings": {
    label: "Company settings",
    can: "Rename the company",
  },
  "company.structure": {
    label: "Company structure",
    can: "Add, rename and delete regions, add a store to the company and move a store to another region",
  },
  "company.people": {
    label: "Company people",
    can: "Invite people into company roles ranked below this one, change a regional manager's region and remove company roles ranked below this one",
  },
};

export function isCompanySwitch(value: unknown): value is CompanySwitch {
  return typeof value === "string" && (COMPANY_SWITCHES as readonly string[]).includes(value);
}

/**
 * Turns what a caller holds into a safe set, in list order. Anything not on
 * the list is ignored, and nothing is added: unlike `view` for a store, no
 * company switch is always present.
 */
export function cleanCompanySwitches(stored: unknown): Set<CompanySwitch> {
  const found = new Set<unknown>(Array.isArray(stored) ? stored : []);
  return new Set(COMPANY_SWITCHES.filter((s) => found.has(s)));
}

/** The summary lines for a set of company switches, in list order. */
export function companySummaryLines(switches: Iterable<CompanySwitch>): string[] {
  const held = new Set(switches);
  return COMPANY_SWITCHES.filter((s) => held.has(s)).map((s) => COMPANY_SWITCH_TEXT[s].can);
}
