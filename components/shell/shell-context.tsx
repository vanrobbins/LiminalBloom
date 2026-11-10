// What the shell knows about who is signed in and where, for components that
// draw part of the shell from inside a page: the phone header (PageHeader) and
// anything that must name the store (the publish dialog, council 10-10).

"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { Store } from "./use-switch-store";

export type ShellValue = { stores: Store[]; activeStoreId: string; user: { name: string; email: string } };

/** The phone header's two sheets. */
export type ShellSheet = "stores" | "account";
type SheetState = { open: (which: ShellSheet) => boolean; set: (which: ShellSheet, open: boolean) => void };

const ShellContext = createContext<ShellValue | null>(null);
const SheetContext = createContext<SheetState | null>(null);

export function ShellProvider({ value, children }: { value: ShellValue; children: React.ReactNode }) {
  // Held here, not in the header: loading.tsx and the page each draw a PageHeader, and a
  // sheet opened from the first must stay open when the second replaces it (B7). It
  // belongs to the page it was opened on, so going anywhere else closes it.
  const pathname = usePathname();
  const [sheet, setSheet] = useState<{ which: ShellSheet; path: string | null } | null>(null);
  const set = useCallback((which: ShellSheet, open: boolean) => setSheet(open ? { which, path: pathname } : null), [pathname]);
  const sheets = useMemo(() => ({ open: (which: ShellSheet) => sheet?.which === which && sheet.path === pathname, set }), [sheet, pathname, set]);
  return (
    <ShellContext value={value}>
      <SheetContext value={sheets}>{children}</SheetContext>
    </ShellContext>
  );
}

/** One of the phone header's sheets: open state shared through the shell, or the component's own outside it. */
export function useShellSheet(which: ShellSheet): [boolean, (open: boolean) => void] {
  const shared = useContext(SheetContext);
  const [own, setOwn] = useState(false);
  return shared ? [shared.open(which), (open) => shared.set(which, open)] : [own, setOwn];
}

/** Null outside the signed-in shell (tests, auth pages). */
export function useShell(): ShellValue | null {
  return useContext(ShellContext);
}

export function useActiveStoreName(): string | null {
  const shell = useShell();
  return shell?.stores.find((s) => s.id === shell.activeStoreId)?.name ?? null;
}
