// "Start planogram", the one labelled call to action in the empty "No planogram
// yet" box (0.7.0.5 spec §2.1; icons-first exemption: with no grid there is
// nothing to tap, and + isn't shown). Everywhere else a change or + starts the draft.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { startDraftAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import type { PlanogramRow } from "@/lib/planograms/queries";
import { toast } from "@/lib/toast";

export function StartPlanogram({ fixtureId, row }: { fixtureId: string; row: PlanogramRow | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const reply = await startDraftAction(fixtureId, row?.version ?? null);
      if (reply.status !== "saved") toast({ tone: "error", title: reply.message });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't start the draft", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button className="w-full sm:w-auto" onClick={start} loading={busy} loadingText="Starting…">
      Start planogram
    </Button>
  );
}
