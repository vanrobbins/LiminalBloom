// Runs one help action and tells the person when it never reached the server. That is the only toast on the
// Help screens (spec 0.7.1 12, R2): a refusal is shown beside the control that was used, by the caller.

"use client";

import { useState } from "react";

import { toast } from "@/lib/toast";

export function useHelpCall() {
  const [isBusy, setIsBusy] = useState(false);

  /** The action's answer, or null after a lost connection. */
  async function call<T>(work: () => Promise<T>): Promise<T | null> {
    setIsBusy(true);
    try {
      return await work();
    } catch {
      toast({ tone: "error", title: "Couldn't reach the server", description: "Check your connection and try again." });
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  return { isBusy, call };
}
