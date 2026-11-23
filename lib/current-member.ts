// Who is asking, which stores they belong to, which one they are working in,
// and what their role there lets them do -- read once per request, however many
// places ask.
//
// The app shell's layout draws from getCurrentMember(), and every signed-in
// page guards itself with requireMember(). The guard stays in each page on
// purpose: a layout is not re-rendered when someone moves between pages, so
// a check there would not run for every page (node_modules/next/dist/docs/
// 01-app/02-guides/authentication.md, "Layouts and auth checks").
//
// A page that needs a permission calls requireSwitch(); an action calls
// requireSwitchForAction(). A member without the switch is sent to /no-access,
// not shown Next's forbidden() page: forbidden() is experimental and needs the
// `authInterrupts` flag (01-app/03-api-reference/04-functions/forbidden.md,
// "version: experimental"), so a plain page inside the app shell does the job.

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { can } from "@/lib/access/can";
import { companyRole } from "@/lib/access/company-roles";
import { resolveAccess } from "@/lib/access/resolve";
import { isPlatformAdmin } from "@/lib/admin/is-admin";
import type { Switch } from "@/lib/access/switches";
import { auth } from "@/lib/auth";
import { helpRepliesFor } from "@/lib/help/badge";
import { pausedStoresOf } from "@/lib/paused";
import { authHref } from "@/lib/return-path";
import { hasSecondFactor } from "@/lib/two-factor/has-second-factor";

import type { CompanyOnly, CurrentMember, Member, NeedsTwoFactor, Paused } from "./current-member-types";

// Also here for server code that already imports this file; client components import ./access/can.
export { can };

export type { CompanyOnly, CurrentMember, Member, MemberStore, NeedsTwoFactor, NoStore, Paused } from "./current-member-types";

/** One read per request: the layout and the page share the result. */
export const getCurrentMember = cache(async (): Promise<CurrentMember> => {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { kind: "signed-out" };
  }

  // The stores this person reaches (their own and their company's), the one this session works in only while
  // they still reach it, and their role and switches there, read afresh on every request. The older
  // `activeOrganizationId` is read only for sessions made before 0021.
  const access = await resolveAccess(session.user.id, session.session);
  const person = { id: session.user.id, name: session.user.name, email: session.user.email };
  // Asked only for a role that requires it (a store role with it on, or any company role), so every other request
  // skips the read. Before the no-store return: a company person with no store yet needs it too. Not
  // `session.two_factor_at`: a trusted-device sign-in has none and the account still has two-factor (DECISIONS 11-23).
  const roleName = access.company ? companyRole(access.company.role).name : access.role?.name;
  if (access.requiresTwoFactor && roleName && !(await hasSecondFactor(session.user.id))) {
    return { kind: "needs-two-factor", user: person, roleName };
  }
  if (!access.activeStoreId) {
    // Nothing resolved: a company role with no store yet, or every store paused, or no store at all.
    if (access.company) return { kind: "company-only", user: person, company: access.company };
    const stores = await pausedStoresOf(session.user.id);
    if (stores.length > 0) return { kind: "paused", user: person, stores };
    return { kind: "no-store", user: person };
  }

  const [isAdmin, helpReplies] = await Promise.all([isPlatformAdmin(session.user.id), helpRepliesFor(session.user.id)]);

  return {
    kind: "member",
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    // Only what the shell shows. These cross into client components. A paused store is not in the list.
    stores: access.stores.map(({ id, name, companyId, companyName, regionName }) => ({ id, name, companyId, companyName, regionName })),
    activeStoreId: access.activeStoreId,
    role: access.role && { id: access.role.id, name: access.role.name, rank: access.role.rank },
    switches: [...access.switches],
    company: access.company,
    isPlatformAdmin: isAdmin,
    helpReplies,
  };
});

/** Where someone with a company role and no store yet lands. */
export const COMPANY_PATH = "/company";

/** Where someone whose stores are all paused lands. */
export const PAUSED_PATH = "/paused";

/** The page that sets two-factor up; the one signed-in page a person who is missing a required factor can open. */
export const TWO_FACTOR_SETUP_PATH = "/account";

/** For pages: the member, or a redirect to where they need to go first. */
export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();

  if (member.kind === "signed-out") {
    redirect("/sign-in");
  }
  if (member.kind === "no-store") {
    redirect("/welcome");
  }
  if (member.kind === "needs-two-factor") {
    redirect(TWO_FACTOR_SETUP_PATH);
  }
  if (member.kind === "paused") {
    redirect(PAUSED_PATH);
  }
  if (member.kind === "company-only") {
    redirect(COMPANY_PATH);
  }

  return member;
}

/**
 * For pages and actions that need an account and nothing else (Help): a member, a person with no store, one whose
 * role still needs two-factor, or one whose stores are all paused. Only a signed-out visitor is sent away. The page
 * chooses its frame from `kind`: the shell for a member, the bare card for the rest (spec 0.7.1 9.3).
 */
export async function requireSignedIn(next?: string): Promise<Exclude<CurrentMember, { kind: "signed-out" }>> {
  const current = await getCurrentMember();
  // A server component cannot read its own address, so a page passes the path to come back to after sign-in.
  if (current.kind === "signed-out") redirect(authHref("/sign-in", next));
  return current;
}

/**
 * What the Account page and its two-factor and passkey actions need: a member, someone who must set two-factor up
 * first, someone whose stores are all paused (they keep their password, two-step and passkeys, DECISIONS 11-23), or
 * a company person with no store yet (company-only): Account is theirs too, in the bare frame.
 */
export async function requireAccountPerson(): Promise<Member | NeedsTwoFactor | Paused | CompanyOnly> {
  const current = await getCurrentMember();
  if (current.kind === "signed-out") redirect("/sign-in");
  if (current.kind === "no-store") redirect("/welcome");
  return current;
}

/**
 * For pages: requireMember() plus a permission. A member without the switch
 * goes to /no-access, which needs only requireMember(), so it cannot loop.
 */
export async function requireSwitch(wanted: Switch): Promise<Member> {
  const member = await requireMember();

  if (!can(member, wanted)) {
    redirect("/no-access");
  }

  return member;
}

export type SwitchCheck = { status: "ok"; member: Member } | { status: "forbidden" };

/**
 * For server actions, which answer with an outcome rather than render a page.
 * Signed-out and no-store visitors are redirected exactly as requireMember()
 * does; a member without the switch gets { status: "forbidden" }.
 */
export async function requireSwitchForAction(wanted: Switch): Promise<SwitchCheck> {
  const member = await requireMember();
  return can(member, wanted) ? { status: "ok", member } : { status: "forbidden" };
}
