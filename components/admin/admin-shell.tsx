// The frame of every /admin page (spec 0.7.1 §12): no store shell. Under 768 px a top bar with a Menu
// icon opening a bottom sheet; 768 to 1023 the same bar with a dropdown; from 1024 a sidebar. All forms
// are rendered and CSS picks one, as the app's shell does, so the right form is there on the first paint.
// Each page sets its own width inside <main>.

import { AdminDropdownMenu, AdminSheetMenu } from "./admin-menu";
import { AdminAccountActions, AdminNavLinks } from "./admin-nav";

const TITLE = "Liminal Bloom admin";

export function AdminShell({ account, children }: { account: { name: string; email: string }; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-surface lg:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded focus:border focus:border-line focus:bg-raised focus:px-4 focus:text-ink"
      >
        Skip to content
      </a>

      {/* Phone and tablet: the top bar. It is not a heading: each page has its own h1. */}
      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-line-subtle bg-raised pl-4 pr-2 lg:hidden">
        <p className="flex min-w-0 flex-1 items-center gap-2 font-semibold tracking-tight text-ink">
          <span aria-hidden="true" className="text-brand-strong">
            &#10052;
          </span>
          <span className="truncate">{TITLE}</span>
        </p>
        <div className="md:hidden">
          <AdminSheetMenu />
        </div>
        <div className="hidden md:block">
          <AdminDropdownMenu email={account.email} />
        </div>
      </header>

      <aside aria-label={TITLE} className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line-subtle bg-raised p-4 lg:flex">
        <p className="flex items-center gap-2 px-3 pt-2 font-semibold tracking-tight text-ink">
          <span aria-hidden="true" className="text-brand-strong">
            &#10052;
          </span>
          {TITLE}
        </p>
        <AdminNavLinks />
        <div className="mt-auto flex flex-col gap-3">
          <p className="min-w-0 px-1 text-sm text-ink-muted">
            <span className="block truncate font-medium text-ink">{account.name}</span>
            <span className="block break-all">{account.email}</span>
          </p>
          <AdminAccountActions />
        </div>
      </aside>

      <main id="content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none md:px-8 md:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
