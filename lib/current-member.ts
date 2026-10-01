// Who is asking, which stores they belong to, and which one they are working
// in -- read once per request, however many places ask.
//
// The app shell's layout draws from getCurrentMember(), and every signed-in
// page guards itself with requireMember(). The guard stays in each page on
// purpose: a layout is not re-rendered when someone moves between pages, so
// a check there would not run for every page (node_modules/next/dist/docs/
// 01-app/02-guides/authentication.md, "Layouts and auth checks").

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { resolveActiveStore } from "@/lib/active-store";
import { auth } from "@/lib/auth";

export type Member = {
  kind: "member";
  user: { id: string; name: string; email: string };
  stores: { id: string; name: string }[];
  activeStoreId: string;
};

export type CurrentMember = { kind: "signed-out" } | { kind: "no-store" } | Member;

/** One read per request: the layout and the page share the result. */
export const getCurrentMember = cache(async (): Promise<CurrentMember> => {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { kind: "signed-out" };
  }

  // The session's store only while this person still belongs to it; see
  // resolveActiveStore for why the session's own value is not enough.
  const activeStoreId = await resolveActiveStore(
    session.user.id,
    session.session.activeOrganizationId,
  );
  if (!activeStoreId) {
    return { kind: "no-store" };
  }

  const stores = await auth.api.listOrganizations({ headers: requestHeaders });

  return {
    kind: "member",
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    // Only what the shell shows. These cross into client components.
    stores: stores.map(({ id, name }) => ({ id, name })),
    activeStoreId,
  };
});

/** For pages: the member, or a redirect to where they need to go first. */
export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();

  if (member.kind === "signed-out") {
    redirect("/sign-in");
  }
  if (member.kind === "no-store") {
    redirect("/create-store");
  }

  return member;
}
