// Who is signed in, and the stores they belong to. Inside the app shell,
// which links here from its navigation and account menu.
//
// requireMember() reads the session on the SERVER, from the request's
// cookies, and redirects a signed-out visitor before any of this page is
// sent -- protected content never reaches a browser that should not have it
// (proposal section 8.3). This is the pattern every signed-in screen follows.

import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // Membership-checked, so a store this person was removed from is never
  // shown as theirs.
  const { user, stores, activeStoreId } = await requireMember();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Account</h1>

      <Card compact>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Name</dt>
            <dd className="text-ink">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Email</dt>
            <dd className="break-all text-ink">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">User id</dt>
            <dd className="break-all font-mono text-xs text-ink-muted">{user.id}</dd>
          </div>
        </dl>
      </Card>

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
                  <span className="text-ink wrap-anywhere">{store.name}</span>
                  {isActive ? (
                    <span className="shrink-0 font-medium text-brand-strong">Working in</span>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
