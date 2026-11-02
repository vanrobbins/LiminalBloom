// Which numbered point is lit, shared by the mock screen's markers and the
// chapter's list of points, so choosing either one highlights both.

"use client";

import { createContext, useContext } from "react";

type PointState = { active: number | null; choose: (n: number) => void };

export const PointContext = createContext<PointState>({ active: null, choose: () => {} });

export function usePoint() {
  return useContext(PointContext);
}
