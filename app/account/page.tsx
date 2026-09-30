// A protected page. This is the pattern every signed-in screen will use.
//
// The session is read on the SERVER, from the request's cookies. A signed-out
// visitor is redirected before any of this page is sent to them, so protected
// content never reaches a browser that should not have it. Checking this in
// the browser instead would mean shipping the content and hoping -- see
// proposal section 8.3.

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveActiveStore } from "@/lib/active-store";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Every store this person belongs to, and the one they are working in --
  // membership-checked, so a store they were removed from is never shown as
  // theirs.
  const stores = await auth.api.listOrganizations({ headers: requestHeaders });
  const activeStoreId = await resolveActiveStore(
    session.user.id,
    session.session.activeOrganizationId,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Signed in</h1>

        <Card compact>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Name</dt>
              <dd className="text-ink">{session.user.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Email</dt>
              <dd className="break-all text-ink">{session.user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">User id</dt>
              <dd className="break-all font-mono text-xs text-ink-muted">
                {session.user.id}
              </dd>
            </div>
          </dl>
        </Card>

        {stores.length === 0 ? (
          <Card compact className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              You are not in a store yet. Create one, or ask an Admin to invite you.
            </p>
            <Button asChild>
              <a href="/create-store">Create a store</a>
            </Button>
          </Card>
        ) : (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">
              {stores.length === 1 ? "Your store" : "Your stores"}
            </h2>
            <ul className="flex flex-col gap-2">
              {stores.map((store) => {
                const isActive = store.id === activeStoreId;

                return (
                  <li key={store.id} aria-current={isActive ? "true" : undefined}>
                    <Card compact className="flex justify-between gap-4 text-sm">
                      <span className="text-ink">{store.name}</span>
                      {isActive ? (
                        <span className="font-medium text-brand-strong">Working in</span>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
            <Button asChild variant="secondary">
              <a href="/products">Go to products</a>
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}
