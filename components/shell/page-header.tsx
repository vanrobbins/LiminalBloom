// Each signed-in page's header (spec §3, council 10-10). On a phone it is the
// sticky top bar: back · title · avatar, and under the title the store line for
// someone in two or more stores. On tablet and desktop it is the page's own
// back link and big title; store and avatar stay in the rail or sidebar.

"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { useShell } from "./shell-context";
import { StoreMenu } from "./store-menu";
import { UserMenu } from "./user-menu";

type PageHeaderProps = {
  title: string;
  back?: { href: string; label: string };
  /** 44 px icon buttons, beside the avatar on a phone. */
  actions?: React.ReactNode;
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function PageHeader({ title, back, actions }: PageHeaderProps) {
  const shell = useShell();
  const showStore = shell !== null && shell.stores.length > 1;

  return (
    <header
      data-page-header
      // On a phone it bleeds over <main>'s padding (px-4 pt-6) to sit flush at the top.
      className="sticky top-0 z-30 -mx-4 -mt-6 mb-4 flex flex-col border-b border-line-subtle bg-raised px-2 md:static md:mx-0 md:mt-0 md:mb-6 md:gap-2 md:border-0 md:bg-transparent md:px-0"
    >
      {back ? (
        <Link href={back.href} className={`hidden min-h-11 items-center self-start text-ink-muted underline-offset-4 hover:underline md:inline-flex ${FOCUS}`}>
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex min-h-14 items-center gap-1 md:min-h-0 md:gap-3">
        {back ? (
          <Link href={back.href} aria-label={`Back to ${back.label}`} className={`inline-flex size-11 shrink-0 items-center justify-center rounded text-ink md:hidden ${FOCUS}`}>
            <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Link>
        ) : (
          <span aria-hidden="true" className="w-2 shrink-0 md:hidden" />
        )}
        <h1
          title={title}
          className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-ink md:overflow-visible md:whitespace-normal md:text-3xl md:wrap-anywhere"
        >
          {title}
        </h1>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        {shell ? (
          <div className="md:hidden">
            <UserMenu variant="sheet" user={shell.user} />
          </div>
        ) : null}
      </div>
      {showStore ? (
        <div className={`-mt-2 pb-1 md:hidden ${back ? "pl-11" : "pl-3"}`}>
          <StoreMenu variant="sheet" stores={shell.stores} activeStoreId={shell.activeStoreId} />
        </div>
      ) : null}
    </header>
  );
}
