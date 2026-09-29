// A protected page. This is the pattern every signed-in screen will use.
//
// The session is read on the SERVER, from the request's cookies. A signed-out
// visitor is redirected before any of this page is sent to them, so protected
// content never reaches a browser that should not have it. Checking this in
// the browser instead would mean shipping the content and hoping -- see
// proposal section 8.3.

import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

        {stores.length === 0 ? (
          <p className="text-sm text-ink-muted">
            You are not in a store yet.{" "}
            <a href="/create-store" className="text-brand-strong underline">
              Create one
            </a>
            , or ask an Admin to invite you.
          </p>
        ) : (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">
              {stores.length === 1 ? "Your store" : "Your stores"}
            </h2>
            <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle text-sm">
              {stores.map((store) => {
                const isActive = store.id === activeStoreId;

                return (
                  <li
                    key={store.id}
                    aria-current={isActive ? "true" : undefined}
                    className="flex justify-between gap-4 bg-raised px-4 py-3"
                  >
                    <span className="text-ink">{store.name}</span>
                    {isActive ? (
                      <span className="font-medium text-brand-strong">
                        Working in
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <a href="/products" className="text-sm text-brand-strong underline">
              Go to products
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
