// What the shell knows about who is signed in and where, for components that
// draw part of the shell from inside a page: the phone header (PageHeader) and
// anything that must name the store (the publish dialog, council 10-10).

"use client";

import { createContext, useContext } from "react";

import type { Store } from "./use-switch-store";

export type ShellValue = { stores: Store[]; activeStoreId: string; user: { name: string; email: string } };

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({ value, children }: { value: ShellValue; children: React.ReactNode }) {
  return <ShellContext value={value}>{children}</ShellContext>;
}

/** Null outside the signed-in shell (tests, auth pages). */
export function useShell(): ShellValue | null {
  return useContext(ShellContext);
}

export function useActiveStoreName(): string | null {
  const shell = useShell();
  return shell?.stores.find((s) => s.id === shell.activeStoreId)?.name ?? null;
}
