// The app's phone chrome, drawn: a header with the store line and title, the
// content, and the bottom tabs as they stand once Home ships (Week 6.5).

import { House, LayoutGrid, Map, Search, User } from "lucide-react";

import { Marker } from "../marker";

export type MockTab = "home" | "products" | "layout" | "planograms" | "account" | "none";

const TABS = [
  { id: "home", label: "Home", icon: House },
  { id: "products", label: "Products", icon: Search },
  { id: "layout", label: "Layout", icon: Map },
  { id: "planograms", label: "Planograms", icon: LayoutGrid },
  { id: "account", label: "Account", icon: User },
] as const;

type MockScreenProps = {
  title?: string;
  tab: MockTab;
  /** Something on the title row's right, such as + and ⋯. */
  actions?: React.ReactNode;
  /** A numbered point on the current tab. */
  tabMarker?: number;
  children: React.ReactNode;
};

export function MockScreen({ title, tab, actions, tabMarker, children }: MockScreenProps) {
  return (
    <>
      <div className="flex justify-between px-6 pt-3 pb-1 font-mono text-xs text-ink-muted">
        <span>9:41</span>
        <span>Pioneer Place</span>
      </div>
      {title ? (
        <div className="flex min-h-12 items-center justify-between gap-2 px-4">
          <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3>
          {actions}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-1 pb-3 *:shrink-0">{children}</div>
      {tab === "none" ? null : (
        <div className="grid grid-cols-5 border-t border-line bg-raised px-1 pt-1.5 pb-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <span
              key={id}
              className={`relative flex flex-col items-center gap-0.5 text-[0.625rem] ${id === tab ? "font-semibold text-brand-strong" : "text-ink-muted"}`}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
              {label}
              {id === tab && tabMarker ? (
                <span className="absolute -top-4 right-0">
                  <Marker n={tabMarker} />
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
