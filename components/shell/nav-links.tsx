// The main navigation in the three forms §5.2 asks for: bottom tabs on a
// phone, a labelled icon rail on a tablet, a sidebar on desktop. One list of
// destinations (nav-items.ts); the shell decides which form shows.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrent, NAV_ITEMS } from "./nav-items";

export type NavVariant = "tabs" | "rail" | "sidebar";

const NAV: Record<NavVariant, string> = {
  // Fixed to the bottom of a phone; the shell pads the page clear of it.
  tabs: "fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-raised md:hidden",
  rail: "w-full",
  sidebar: "w-full",
};

const LIST: Record<NavVariant, string> = {
  tabs: "mx-auto flex max-w-lg",
  rail: "flex flex-col items-center gap-1",
  sidebar: "flex flex-col gap-1",
};

const FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";

const LINK: Record<NavVariant, string> = {
  tabs: `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 border-t-2 text-xs ${FOCUS}`,
  rail: `flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded text-xs ${FOCUS}`,
  sidebar: `flex min-h-11 items-center gap-3 rounded px-3 text-sm ${FOCUS}`,
};

// §5.5: gold marks the current selection. Current and idle never share a
// class, so neither can win by stylesheet order.
const CURRENT: Record<NavVariant, string> = {
  tabs: "border-brand font-medium text-brand-strong",
  rail: "bg-brand font-medium text-on-brand",
  sidebar: "bg-brand font-medium text-on-brand",
};

const IDLE: Record<NavVariant, string> = {
  tabs: "border-transparent text-ink-muted",
  rail: "text-ink-muted",
  sidebar: "text-ink-muted",
};

export function NavLinks({ variant }: { variant: NavVariant }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" data-nav={variant} className={NAV[variant]}>
      <ul className={LIST[variant]}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(href, pathname);

          return (
            <li key={href} className={variant === "tabs" ? "flex flex-1" : undefined}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`${LINK[variant]} ${current ? CURRENT[variant] : IDLE[variant]}`}
              >
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
