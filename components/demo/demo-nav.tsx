// Where one demo app is: its screen, the open product sheet and the toast.
// Kept in React state, never the URL, so the walkthrough's chapter links and
// the demo never fight over the address bar.

"use client";

import { createContext, useContext } from "react";

import type { Route } from "@/lib/demo/route";

export type { Route };

export type Toast = {
  id: number;
  text: string;
  tone?: "refused";
  action?: { label: string; run: () => void };
};

export type Nav = {
  route: Route;
  go: (route: Route) => void;
  sheet: string | null;
  openSheet: (productId: string) => void;
  closeSheet: () => void;
  toast: Toast | null;
  say: (text: string, options?: Omit<Toast, "id" | "text">) => void;
};

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav needs a DemoApp");
  return nav;
}
