// A protected page. This is the pattern every signed-in screen will use.
//
// The session is read on the SERVER, from the request's cookies. A signed-out
// visitor is redirected before any of this page is sent to them, so protected
// content never reaches a browser that should not have it. Checking this in
// the browser instead would mean shipping the content and hoping -- see
// proposal section 8.3.

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Signed in
        </h1>

        <dl className="flex flex-col gap-2 rounded-lg border border-line-subtle bg-raised p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Name</dt>
            <dd className="text-ink">
              {session.user.name}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Email</dt>
            <dd className="text-ink">
              {session.user.email}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              User id
            </dt>
            <dd className="font-mono text-xs text-ink-muted">
              {session.user.id}
            </dd>
          </div>
        </dl>

        <p className="text-sm text-ink-muted">
          No store yet. Creating one, and assigning roles within it, is the next
          step.
        </p>
      </div>
    </main>
  );
}
