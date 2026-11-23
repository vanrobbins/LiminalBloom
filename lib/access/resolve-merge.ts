// The pure half of resolveAccess (spec 0.7.1, 4.2): given what grants.ts read, which stores the person reaches,
// which one a request works in, and the role and switches there. No database, so it is tested alone.
//
// Two kinds of grant meet here. A `member` row gives a store role in one store. A company role (owner,
// corporate admin, regional manager) gives a fixed bundle in each store of the company, or of the region.
// Where both reach a store the switches are unioned and the higher rank is the one shown; neither grant
// takes anything from the other.

import { companyRole, syntheticStoreRole, type CompanyRoleKey } from "./company-roles";
import type { CompanySwitch } from "./company-switches";
import { withLockedSwitches, type BuiltinRoleKey } from "./roles";
import { cleanSwitches, type Switch } from "./switches";

export type ResolvedRole = { id: string; name: string; rank: number; builtin: BuiltinRoleKey | null };

/** A store with the company and region it sits in (all null for a standalone store). */
export type StoreInfo = { id: string; name: string; companyId: string | null; companyName: string | null; regionId: string | null; regionName: string | null };

/** A `member` row: the role is null when the row names none that exists in the store. */
export type MemberGrant = StoreInfo & {
  joinedAt: Date;
  role: (ResolvedRole & { stored: unknown; requiresTwoFactor: boolean }) | null;
};

/** The person's one company role, with the company and (for a regional manager) the region it is held in. */
export type CompanyGrant = { companyId: string; companyName: string; role: CompanyRoleKey; regionId: string | null; regionName: string | null };

export type Grants = {
  members: MemberGrant[];
  company: CompanyGrant | null;
  /** The stores the company role reaches: every store of the company, or of the region. Neither paused. */
  companyStores: StoreInfo[];
  lastActiveStoreId: string | null;
};

/** What the request's session says about the active store. Either may be missing, stale or null. */
export type SessionPointers = { activeStoreId?: string | null; activeOrganizationId?: string | null };

export type CompanyAccess = { id: string; name: string; role: CompanyRoleKey; regionId: string | null; regionName: string | null; switches: CompanySwitch[] };

export type Access = {
  /** The store the request works in, or null when the person reaches none. */
  activeStoreId: string | null;
  /** The higher-ranked of the member role and the company role; null for a member with no role. */
  role: ResolvedRole | null;
  /** `view` and nothing else for a member with no role; empty only when there is no store. */
  switches: ReadonlySet<Switch>;
  /** The member role asks for two-factor sign-in (0.7.1a). Company roles are fixed bundles and never ask. */
  requiresTwoFactor: boolean;
  /** Every store the person reaches, in switcher order: their company by region, other companies, then standalone. */
  stores: StoreInfo[];
  /** Held whether or not any store resolves (a new owner has none yet). */
  company: CompanyAccess | null;
};

const VIEW_ONLY: ReadonlySet<Switch> = new Set<Switch>(["view"]);

const info = ({ id, name, companyId, companyName, regionId, regionName }: StoreInfo): StoreInfo => ({ id, name, companyId, companyName, regionId, regionName });

// Nulls last, then by text.
const text = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b));

function listOrder(own: string | null) {
  const group = (s: StoreInfo) => (s.companyId === null ? 2 : s.companyId === own ? 0 : 1);
  return (a: StoreInfo, b: StoreInfo) => group(a) - group(b) || text(a.companyName, b.companyName) || text(a.regionName, b.regionName) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export function mergeAccess(grants: Grants, session: SessionPointers): Access {
  const { company } = grants;
  const reached = new Map<string, StoreInfo>();
  for (const m of grants.members) reached.set(m.id, info(m));
  for (const s of grants.companyStores) if (!reached.has(s.id)) reached.set(s.id, info(s));
  const stores = [...reached.values()].sort(listOrder(company?.companyId ?? null));

  const companyAccess: CompanyAccess | null = company && {
    id: company.companyId,
    name: company.companyName,
    role: company.role,
    regionId: company.regionId,
    regionName: company.regionName,
    switches: [...companyRole(company.role).companySwitches],
  };

  const byJoined = [...grants.members].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id));
  const byName = [...grants.companyStores].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const activeStoreId =
    [session.activeStoreId, session.activeOrganizationId, grants.lastActiveStoreId, byJoined[0]?.id, byName[0]?.id].find((id): id is string => !!id && reached.has(id)) ?? null;
  if (!activeStoreId) return { activeStoreId: null, role: null, switches: new Set(), requiresTwoFactor: false, stores, company: companyAccess };

  const asMember = grants.members.find((m) => m.id === activeStoreId);
  const viaCompany = company && grants.companyStores.some((s) => s.id === activeStoreId) ? companyRole(company.role) : null;

  const switches = new Set<Switch>(asMember ? (asMember.role ? withLockedSwitches(cleanSwitches(asMember.role.stored), asMember.role.builtin) : VIEW_ONLY) : []);
  for (const s of viaCompany?.storeSwitches ?? []) switches.add(s);

  const memberRole: ResolvedRole | null = asMember?.role ? { id: asMember.role.id, name: asMember.role.name, rank: asMember.role.rank, builtin: asMember.role.builtin } : null;
  const companyShown = viaCompany ? syntheticStoreRole(viaCompany.key) : null;
  // A smaller rank number is the higher rank.
  const role = memberRole && companyShown ? (companyShown.rank < memberRole.rank ? companyShown : memberRole) : (memberRole ?? companyShown);

  return { activeStoreId, role, switches, requiresTwoFactor: asMember?.role?.requiresTwoFactor ?? false, stores, company: companyAccess };
}
