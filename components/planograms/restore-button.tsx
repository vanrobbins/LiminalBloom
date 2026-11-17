// Restore (spec §4.6): always into a draft, after saying it replaces the current one.

"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { restoreAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

export function RestoreButton({ fixtureId, expectedVersion, number }: { fixtureId: string; expectedVersion: number; number: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      const reply = await restoreAction(fixtureId, expectedVersion, number);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      setOpen(false);
      if (reply.status === "saved") router.push(`/planograms/${fixtureId}`);
      else router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't restore", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon variant="secondary" onClick={() => setOpen(true)} aria-label={`Restore version ${number}`}>
        <RotateCcw aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Restore version ${number}?`} description="It becomes the draft, replacing any draft in progress. Nothing changes on the floor until you publish.">
        <Button onClick={restore} loading={busy} loadingText="Restoring…">
          Restore as draft
        </Button>
      </Dialog>
    </>
  );
}
