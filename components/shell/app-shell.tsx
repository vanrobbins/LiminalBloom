// The frame around every signed-in page (§5.2). Three forms, all rendered,
// and CSS picks one: under 768 px a top bar and bottom tabs; 768-1023 px an
// icon rail; 1024 px and up a sidebar. Choosing in CSS rather than measuring
// the screen in JavaScript means the right form is there on the first paint,
// with nothing to swap after hydration. The others are display:none, so the
// keyboard and screen readers only ever meet one.

import type { Member } from "@/lib/current-member";

import { NavLinks } from "./nav-links";
import { StoreMenu } from "./store-menu";
import { UserMenu } from "./user-menu";

export function AppShell({ member, children }: { member: Member; children: React.ReactNode }) {
  const { user, stores, activeStoreId } = member;

  return (
    <div className="flex flex-1 flex-col bg-surface md:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded focus:border focus:border-line focus:bg-raised focus:px-4 focus:text-ink"
      >
        Skip to content
      </a>

      {/* Phone: store and account in a top bar; tabs at the bottom. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line-subtle bg-raised px-4 py-2 md:hidden">
        <StoreMenu variant="sheet" stores={stores} activeStoreId={activeStoreId} />
        <UserMenu variant="sheet" user={user} />
      </header>

      {/* Tablet: a rail with labelled icons. */}
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-4 border-r border-line-subtle bg-raised py-4 md:flex lg:hidden">
        <StoreMenu variant="initials" stores={stores} activeStoreId={activeStoreId} />
        <NavLinks variant="rail" />
        <div className="mt-auto">
          <UserMenu variant="rail" user={user} />
        </div>
      </aside>

      {/* Desktop: the full sidebar. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line-subtle bg-raised p-4 lg:flex">
        <p className="flex items-center gap-2 px-3 pt-2 font-semibold tracking-tight text-ink">
          <span aria-hidden="true" className="text-brand-strong">
            &#10052;
          </span>
          liminal bloom
        </p>
        <StoreMenu variant="name" stores={stores} activeStoreId={activeStoreId} />
        <NavLinks variant="sidebar" />
        <div className="mt-auto">
          <UserMenu variant="sidebar" user={user} />
        </div>
      </aside>

      {/* Bottom padding keeps the last row clear of the phone's tabs. */}
      <main
        id="content"
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 pt-6 pb-28 outline-none md:px-8 md:py-10"
      >
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </main>

      <NavLinks variant="tabs" />
    </div>
  );
}
