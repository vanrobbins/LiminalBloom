// One running copy of the demo app: its own screen, product sheet and toast,
// over the shared demo store. It lays itself out by its own width (container
// queries): bottom tabs when narrow, as in the walkthrough's phone; a sidebar
// from 48rem, as full screen on a computer.

"use client";

import { House, LayoutGrid, Map, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NavContext, type Nav, type Route, type Toast } from "./demo-nav";
import { useDemoStore } from "./demo-store";
import { DemoToast } from "./demo-toast";
import { FOCUS } from "./looks";
import { ProductSheet } from "./product-sheet";
import { DemoScreen } from "./screens/demo-screen";

const TABS = [
  { route: { name: "home" }, label: "Home", icon: House },
  { route: { name: "products" }, label: "Products", icon: Search },
  { route: { name: "layout" }, label: "Layout", icon: Map },
  { route: { name: "planograms" }, label: "Planograms", icon: LayoutGrid },
  { route: { name: "account" }, label: "Account", icon: User },
] as const;

/** Which tab a screen belongs under. */
function tabOf(route: Route): Route["name"] {
  if (route.name === "planogram") return "planograms";
  if (route.name === "quick-adjust") return "home";
  return route.name;
}

export function DemoApp({ start, startSheet = null }: { start: Route; startSheet?: string | null }) {
  const { state } = useDemoStore();
  const [route, setRoute] = useState<Route>(start);
  const [sheet, setSheet] = useState<string | null>(startSheet);
  const [toast, setToast] = useState<Toast | null>(null);
  // Each toast gets a new id, so the same words twice still restart the timer.
  const toastCount = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((now) => (now?.id === toast.id ? null : now)), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const nav: Nav = {
    route,
    go: (next) => {
      setSheet(null);
      setRoute(next);
    },
    sheet,
    openSheet: setSheet,
    closeSheet: () => setSheet(null),
    toast,
    say: (text, options) => {
      toastCount.current += 1;
      setToast({ id: toastCount.current, text, ...options });
    },
  };
  const current = tabOf(route);

  return (
    <NavContext.Provider value={nav}>
      <div data-demo className="@container relative flex h-full min-h-0 flex-1 flex-col bg-surface text-ink">
        <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
          <nav
            aria-label="Demo app"
            className="order-last grid grid-cols-5 border-t border-line bg-raised @3xl:order-first @3xl:flex @3xl:w-56 @3xl:flex-col @3xl:gap-1 @3xl:border-t-0 @3xl:border-r @3xl:p-3"
          >
            <p className="hidden px-3 pt-1 pb-3 text-sm @3xl:block">
              <span className="block font-semibold">Pioneer Place</span>
              <span className="text-ink-muted">{state.role === "vm-lead" ? "VM Lead" : "Sales Associate"} · demo store</span>
            </p>
            {TABS.map(({ route: to, label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-current={current === to.name ? "page" : undefined}
                onClick={() => nav.go(to)}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-ink-muted aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong @3xl:flex-row @3xl:justify-start @3xl:gap-3 @3xl:rounded @3xl:px-3 @3xl:text-sm @3xl:aria-[current=page]:bg-brand @3xl:aria-[current=page]:text-on-brand ${FOCUS}`}
              >
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                {label}
              </button>
            ))}
          </nav>
          {/* Keyed by route, so each new screen starts scrolled to the top. */}
          <main key={JSON.stringify(route)} className="relative min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 pb-6">
              <DemoScreen />
            </div>
          </main>
        </div>
        <DemoToast />
        <ProductSheet />
      </div>
    </NavContext.Provider>
  );
}
