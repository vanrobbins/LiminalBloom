// Holds the demo store for everything under it. The walkthrough wraps all its
// chapters in one, so a product marked sold out in one chapter is still sold
// out in the next. Lives in memory only: a reload starts fresh.

"use client";

import { createContext, useContext, useReducer } from "react";

import { demoReducer, type DemoAction } from "@/lib/demo/reducer";
import { seedState } from "@/lib/demo/seed";
import type { DemoState } from "@/lib/demo/types";

type Store = { state: DemoState; dispatch: (action: DemoAction) => void };

const StoreContext = createContext<Store | null>(null);

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, seedState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useDemoStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useDemoStore needs a DemoStoreProvider");
  return store;
}
