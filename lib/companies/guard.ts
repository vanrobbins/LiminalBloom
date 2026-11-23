// Who may open /company and act on a company (spec 0.7.1 6.1). Company switches are checked as store switches
// are (lib/current-member.ts): a page calls requireCompanyPerson(), an action requireCompanyForAction(). The
// company and the person come from the session, never from the browser, so a write cannot name another company.

import "server-only";

import { redirect } from "next/navigation";

import type { CompanyAccess } from "@/lib/access/resolve-merge";
import type { CompanySwitch } from "@/lib/access/company-switches";
import { getCurrentMember } from "@/lib/current-member";
import { pausedStoresOf } from "@/lib/paused";
import type { Member } from "@/lib/current-member-types";

export type CompanyPerson = { kind: "member" | "company-only"; user: Member["user"]; company: CompanyAccess; activeStoreId: string | null };

/**
 * A person with a company role, in a store or (company-only) with none yet. Everyone else is sent where they
 * belong: a signed-out visitor to sign-in, a missing two-factor to Account, paused stores to /paused, no store
 * to /welcome, and a store member with no company role to /no-access, or to Home when their company is paused.
 */
export async function requireCompanyPerson(): Promise<CompanyPerson> {
  const current = await getCurrentMember();
  if (current.kind === "signed-out") redirect("/sign-in");
  if (current.kind === "needs-two-factor") redirect("/account");
  if (current.kind === "paused") redirect("/paused");
  if (current.kind === "no-store") redirect("/welcome");
  if (current.kind === "company-only") return { kind: "company-only", user: current.user, company: current.company, activeStoreId: null };
  if (!current.company) {
    // A company role is dropped while its company is paused: someone with a standalone store as well is not "without
    // access", their company is paused. /paused would send a person with a working store back, so they go Home.
    if ((await pausedStoresOf(current.user.id)).some((s) => s.kind === "company")) redirect("/home");
    redirect("/no-access");
  }
  return { kind: "member", user: current.user, company: current.company, activeStoreId: current.activeStoreId };
}

export type CompanyCheck = { status: "ok"; person: CompanyPerson } | { status: "forbidden" };

/** For server actions: requireCompanyPerson() plus a company switch; a person without it gets "forbidden". */
export async function requireCompanyForAction(wanted: CompanySwitch): Promise<CompanyCheck> {
  const person = await requireCompanyPerson();
  return person.company.switches.includes(wanted) ? { status: "ok", person } : { status: "forbidden" };
}
