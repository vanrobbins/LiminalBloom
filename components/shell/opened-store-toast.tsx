// "Opened Washington Square" just after sign-in, for someone in two or more
// stores: sign-in reopens the last store used, and a sister store reopened on
// a Monday should be noticed before anything is published there (council 10-10).

"use client";

import { useEffect } from "react";

import { toast } from "@/lib/toast";

import { useShell } from "./shell-context";

const FLAG = "liminal:signed-in";

/** Called by the sign-in page just before it navigates. */
export function markSignedIn(): void {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // Storage blocked (private mode): no notice, nothing else changes.
  }
}

function takeFlag(): boolean {
  try {
    const flagged = sessionStorage.getItem(FLAG) === "1";
    sessionStorage.removeItem(FLAG);
    return flagged;
  } catch {
    return false;
  }
}

export function OpenedStoreToast() {
  const shell = useShell();
  useEffect(() => {
    // Taken whatever happens next, so it fires once (Strict Mode runs this twice).
    if (!takeFlag() || !shell || shell.stores.length < 2) return;
    const name = shell.stores.find((s) => s.id === shell.activeStoreId)?.name;
    if (name) toast({ tone: "success", title: `Opened ${name}` });
  }, [shell]);
  return null;
}
