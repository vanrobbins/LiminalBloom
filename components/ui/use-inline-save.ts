// The save behind a small setting that saves as you change it (R3, 0.7.0.5; CODESTYLE
// rule 14): the due date, the store's name, its time zone. `status` is the one save
// indicator's state (PanelSaveLine), a refusal comes back for the form to put under its
// field, and only a lost connection is a toast. The page reloads after every save, so
// every other place that shows the value follows; `busy` lasts until that has landed.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DraftStatus } from "@/components/planograms/use-planogram-draft";
import { toast } from "@/lib/toast";

type Reply = { status: string; message: string };

export function useInlineSave(failTitle = "Couldn't save") {
  const router = useRouter();
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  const [reloading, reload] = useTransition();

  /** The server's reply, or null when the connection failed (the toast has said so). */
  async function save<R extends Reply>(send: () => Promise<R>): Promise<R | null> {
    setStatus({ kind: "saving" });
    try {
      const reply = await send();
      setStatus(reply.status === "saved" ? { kind: "saved" } : { kind: "refused", message: reply.message });
      reload(() => router.refresh());
      return reply;
    } catch {
      setStatus({ kind: "idle" });
      toast({ tone: "error", title: failTitle, description: "Check the connection and try again." });
      return null;
    }
  }

  return { status, save, busy: status.kind === "saving" || reloading };
}
