// Revert (0.7.0.9 spec §4.4): ends the published Quick Adjust and puts the version back on the floor, after saying what goes back.
// A draft that copied these changes stays (it is somebody's work), and the dialog says so. The line goes when the page
// refreshes, taking this button with it, so focus then goes to the version line (§7), not to nowhere.

"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { revertAdjustmentAction } from "@/app/(app)/planograms/adjust-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

type RevertAdjustmentProps = {
  fixtureId: string;
  adjustmentId: string;
  number: number;
  words: readonly string[];
  /** A Quick Adjust draft exists: it copied these changes when it was opened. */
  draftHolds?: boolean;
};

const STILL_HELD = "A Quick Adjust draft still holds these changes. Publishing it would put them back.";

export function RevertAdjustment({ fixtureId, adjustmentId, number, words, draftHolds = false }: RevertAdjustmentProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reverted = useRef(false);
  useEffect(
    () => () => {
      if (reverted.current) document.querySelector<HTMLElement>("[data-version-line]")?.focus();
    },
    [],
  );

  async function revert() {
    setBusy(true);
    try {
      const reply = await revertAdjustmentAction(fixtureId, adjustmentId);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      reverted.current = true;
      setOpen(false);
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't revert", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon variant="secondary" onClick={() => setOpen(true)} aria-label="Revert Quick Adjust">
        <RotateCcw aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Put Version ${number} back on the floor?`} description={[words.join(" ") || "The Quick Adjust ends.", draftHolds ? STILL_HELD : null].filter(Boolean).join(" ")} onCloseAutoFocus={(e) => reverted.current && e.preventDefault()}>
        <Button onClick={revert} loading={busy} loadingText="Reverting…">
          Revert
        </Button>
      </Dialog>
    </>
  );
}
