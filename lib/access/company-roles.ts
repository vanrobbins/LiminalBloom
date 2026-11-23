// The three company roles as fixed bundles in code (spec 0.7.1, 2.1 and 2.2),
// like BUILTIN_ROLES for stores. Ranks share the one ladder: smaller is higher,
// and 10-30 sit above every store role (100-500). Pure: no database. B4 connects
// these to `role_assignments` and `companies.owner_user_id`.

import { COMPANY_SWITCHES, type CompanySwitch } from "./company-switches";
import { canActOnCompany, type CompanyActor } from "./rank";
import { SWITCHES, type Switch } from "./switches";

/** The owner is a fact (`companies.owner_user_id`), not a row; the other two match the `company_role` enum. */
export type AssignableCompanyRoleKey = "corporate_admin" | "regional_manager";
export type CompanyRoleKey = "owner" | AssignableCompanyRoleKey;

export type CompanyRole = {
  key: CompanyRoleKey;
  name: string;
  rank: number;
  /** In list order. */
  companySwitches: readonly CompanySwitch[];
  /** What the person holds in each store they reach, in list order. */
  storeSwitches: readonly Switch[];
  /** Holding the role asks for two-factor sign-in, as a store role with "Requires two-factor" on does (DECISIONS 11-23). */
  requiresTwoFactor: boolean;
};

const role = (r: CompanyRole): CompanyRole =>
  Object.freeze({ ...r, companySwitches: Object.freeze([...r.companySwitches]), storeSwitches: Object.freeze([...r.storeSwitches]) });

/** Top rank first. */
export const COMPANY_ROLES: readonly CompanyRole[] = Object.freeze([
  role({ key: "owner", name: "Owner", rank: 10, companySwitches: COMPANY_SWITCHES, storeSwitches: SWITCHES, requiresTwoFactor: true }),
  role({ key: "corporate_admin", name: "Corporate Admin", rank: 20, companySwitches: COMPANY_SWITCHES, storeSwitches: SWITCHES, requiresTwoFactor: true }),
  // Read-only in a store, plus managing people there; never store data (DECISIONS 11-11).
  role({ key: "regional_manager", name: "Regional Manager", rank: 30, companySwitches: [], storeSwitches: ["view", "people.manage"], requiresTwoFactor: true }),
]);

export function companyRole(key: CompanyRoleKey): CompanyRole {
  const found = COMPANY_ROLES.find((r) => r.key === key);
  if (!found) throw new Error(`Unknown company role: ${key}`);
  return found;
}

const SYNTHETIC_PREFIX = "company:";

export type SyntheticStoreRole = { id: string; name: string; rank: number; builtin: null };

/**
 * The role a company person shows in a store: `company:<key>` never collides
 * with a uuid, and no write accepts it as a `role_id`.
 */
export function syntheticStoreRole(key: CompanyRoleKey): SyntheticStoreRole {
  const { name, rank } = companyRole(key);
  return { id: `${SYNTHETIC_PREFIX}${key}`, name, rank, builtin: null };
}

export function isSyntheticRoleId(id: string): boolean {
  return id.startsWith(SYNTHETIC_PREFIX);
}

/** A company role as the actor `canActOnCompany` takes. */
export function companyActor(key: CompanyRoleKey): CompanyActor {
  const { rank, companySwitches } = companyRole(key);
  return { rank, switches: new Set(companySwitches) };
}

/**
 * Whether someone in `actor` may invite or assign `target`. Strictly lower
 * ranks only, so a corporate admin cannot make another corporate admin, and
 * nobody can assign owner (that is only a hand-off, spec 5.5).
 */
export function canAssignCompanyRole(actor: CompanyRoleKey, target: CompanyRoleKey): boolean {
  return target !== "owner" && canActOnCompany(companyActor(actor), companyRole(target).rank, "company.people");
}
