// The shapes getCurrentMember() returns (lib/current-member.ts). Types only, so client components may import them.

import type { CompanyAccess } from "@/lib/access/resolve-merge";
import type { Switch } from "@/lib/access/switches";

/**
 * A store the person reaches, with where it sits: the switcher groups on these (spec 0.7.1, 11). A standalone
 * store has null company and region names. Company and region names are the person's to see (spec 13).
 */
export type MemberStore = { id: string; name: string; companyId: string | null; companyName: string | null; regionName: string | null };

export type Member = {
  kind: "member";
  user: { id: string; name: string; email: string };
  /** Every store they reach, in switcher order: their company by region, other companies, then standalone. */
  stores: MemberStore[];
  activeStoreId: string;
  // Plain values, so the whole member can cross into client components.
  role: { id: string; name: string; rank: number } | null;
  switches: Switch[];
  /** Their company role (owner, corporate admin or regional manager) with its permissions, or null. */
  company: CompanyAccess | null;
  /** Only the avatar menu's link to /admin reads this; the admin guard re-reads the admin table itself. */
  isPlatformAdmin: boolean;
  /** Help requests Liminal Bloom has answered since the person last opened them: the avatar's dot and "Help · N replies". */
  helpReplies: number;
};

/** Signed in and in no store yet. They still have an account, so Help and /welcome know who they are. */
export type NoStore = { kind: "no-store"; user: Member["user"] };

/**
 * Signed in, but the role in the active store asks for two-factor sign-in and the account has none
 * (0.7.1a "Requires two-factor"). Nothing of the store is read or shown: the only pages that answer
 * are Account, which sets it up, and sign-out. `requireMember` sends everyone else to /account.
 */
export type NeedsTwoFactor = { kind: "needs-two-factor"; user: Member["user"]; roleName: string };

/**
 * Signed in and in at least one store, but every store they belong to is paused by Liminal Bloom (spec 0.7.1
 * 7.4). Nothing of any store is read: `requireMember` sends them to /paused, which names the stores.
 */
export type Paused = { kind: "paused"; user: Member["user"]; stores: { id: string; name: string; kind: "store" | "company" }[] };

/**
 * Signed in with a company role but no store that resolves yet (a new owner, or a regional manager of an empty
 * region). `requireMember` sends them to /company, which needs no store.
 */
export type CompanyOnly = { kind: "company-only"; user: Member["user"]; company: CompanyAccess };

export type CurrentMember = { kind: "signed-out" } | NoStore | NeedsTwoFactor | Paused | CompanyOnly | Member;
