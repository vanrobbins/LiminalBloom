// Add product, Publish…, Discard draft (spec §5.3).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { discardDraftAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

import { PublishDialog } from "./publish-dialog";

export function DraftBar({ fixtureId, draftVersion, onAdd }: { fixtureId: string; draftVersion: number; onAdd: () => void }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function discard() {
    setBusy(true);
    try {
      const reply = await discardDraftAction(fixtureId, draftVersion);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      setDiscarding(false);
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't discard", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onAdd}>Add product</Button>
      <Button variant="secondary" onClick={() => setPublishing(true)}>
        Publish…
      </Button>
      <Button variant="ghost" onClick={() => setDiscarding(true)}>
        Discard draft
      </Button>
      <PublishDialog open={publishing} onOpenChange={setPublishing} fixtureId={fixtureId} />
      <Dialog open={discarding} onOpenChange={setDiscarding} title="Discard this draft?" description="Every change since it started is lost. The published planogram stays as it is.">
        <Button variant="danger" onClick={discard} loading={busy} loadingText="Discarding…">
          Discard draft
        </Button>
      </Dialog>
    </div>
  );
}
