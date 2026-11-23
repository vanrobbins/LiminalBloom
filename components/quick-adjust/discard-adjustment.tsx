// Discard the draft Quick Adjust (0.7.0.9 spec §4.5): a confirm, a toast (a long, final task whose result is on the next
// screen), then back to the planogram, which still shows the floor as it was. Focus goes to the main area.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { discardAdjustmentAction } from "@/app/(app)/planograms/adjust-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

type DiscardAdjustmentProps = { open: boolean; onOpenChange: (open: boolean) => void; fixtureId: string; adjustmentId: string; expectedVersion: number };

export function DiscardAdjustment({ open, onOpenChange, fixtureId, adjustmentId, expectedVersion }: DiscardAdjustmentProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  async function discard() {
    setBusy(true);
    try {
      const reply = await discardAdjustmentAction(fixtureId, adjustmentId, expectedVersion);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      setGone(reply.status === "saved");
      onOpenChange(false);
      // Discarded: the planogram is the way back. Refused (changed elsewhere): this screen reloads to what is there.
      if (reply.status === "saved") router.push(`/planograms/${fixtureId}`);
      else router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't discard", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title="Discard this Quick Adjust?"
      description="The floor stays as it is."
      // Back to the Discard button, or, after a discard that went through (the page is on its way out), the main area.
      onCloseAutoFocus={(event) => {
        if (!gone) return;
        event.preventDefault();
        document.getElementById("content")?.focus();
      }}
    >
      <Button variant="danger" onClick={discard} loading={busy} loadingText="Discarding…">
        Discard
      </Button>
    </Dialog>
  );
}
