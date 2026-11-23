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
import { resolveAccess } from "@/lib/access/resolve";
import { isPlatformAdmin } from "@/lib/admin/is-admin";
import type { Switch } from "@/lib/access/switches";
import { auth } from "@/lib/auth";
import { hasSecondFactor } from "@/lib/two-factor/has-second-factor";

// Also here for server code that already imports this file; client components import ./access/can.
export { can };

export type Member = {
  kind: "member";
  user: { id: string; name: string; email: string };
  stores: { id: string; name: string }[];
  activeStoreId: string;
  // Plain values, so the whole member can cross into client components.
  role: { id: string; name: string; rank: number } | null;
  switches: Switch[];
  /** Only the avatar menu's link to /admin reads this; the admin guard re-reads the admin table itself. */
  isPlatformAdmin: boolean;
};

/**
 * Signed in, but the role in the active store asks for two-factor sign-in and the account has none
 * (0.7.1a "Requires two-factor"). Nothing of the store is read or shown: the only pages that answer
 * are Account, which sets it up, and sign-out. `requireMember` sends everyone else to /account.
 */
export type NeedsTwoFactor = { kind: "needs-two-factor"; user: Member["user"]; roleName: string };

export type CurrentMember = { kind: "signed-out" } | { kind: "no-store" } | NeedsTwoFactor | Member;

/** One read per request: the layout and the page share the result. */
export const getCurrentMember = cache(async (): Promise<CurrentMember> => {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { kind: "signed-out" };
  }

  // The session's store only while this person still belongs to it (see
  // resolveActiveStore for why the session's own value is not enough), and
  // their role and switches in that store, read afresh on every request.
  const access = await resolveAccess(
    session.user.id,
    session.session.activeOrganizationId,
  );
  if (!access.activeStoreId) {
    return { kind: "no-store" };
  }

  // Asked only for a role that requires it, so every other request skips the read. Not `session.two_factor_at`:
  // a trusted-device sign-in has none and the account still has two-factor (DECISIONS 11-23).
  if (access.requiresTwoFactor && access.role && !(await hasSecondFactor(session.user.id))) {
    return { kind: "needs-two-factor", user: { id: session.user.id, name: session.user.name, email: session.user.email }, roleName: access.role.name };
  }

  const [stores, isAdmin] = await Promise.all([auth.api.listOrganizations({ headers: requestHeaders }), isPlatformAdmin(session.user.id)]);

  return {
    kind: "member",
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    // Only what the shell shows. These cross into client components.
    stores: stores.map(({ id, name }) => ({ id, name })),
    activeStoreId: access.activeStoreId,
    role: access.role && { id: access.role.id, name: access.role.name, rank: access.role.rank },
    switches: [...access.switches],
    isPlatformAdmin: isAdmin,
  };
});

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

  return member;
}

/** What the Account page and its two-factor actions need: a member, or someone who must set two-factor up first. The one guard that lets the second kind through. */
export async function requireAccountPerson(): Promise<Member | NeedsTwoFactor> {
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
