"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { previewPublishAction, publishAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { endingWords } from "@/lib/planograms/adjust-words";
import { faceSummary } from "@/lib/planograms/diff";
import type { Preview } from "@/lib/planograms/publish";
import { toast } from "@/lib/toast";

export function PublishBody({ fixtureId, store, onDone, onPublished }: { fixtureId: string; store: string; onDone: () => void; onPublished?: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null | "loading">("loading");
  const [reloads, setReloads] = useState(0);
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    previewPublishAction(fixtureId)
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview(null));
    return () => {
      live = false;
    };
  }, [fixtureId, reloads]);

  // A refusal's words stay above whatever the reloaded preview shows, even "no longer open".
  const alert = message ? (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  ) : null;

  if (preview === "loading") return <p className="text-ink-muted">Checking the draft…</p>;
  if (preview === null) {
    return (
      <div className="flex flex-col gap-4">
        {alert}
        <p className="text-ink">This draft is no longer open. Close and reload.</p>
      </div>
    );
  }

  async function publish(p: Preview) {
    setBusy(true);
    try {
      const reply = await publishAction(fixtureId, p.planogramVersion, p.basedOnVersion, summary);
      if (reply.status === "saved") {
        toast({ tone: "success", title: reply.message });
        onDone();
        if (onPublished) onPublished();
        else router.refresh();
        return;
      }
      setMessage(reply.message);
      setReloads((n) => n + 1);
    } catch {
      toast({ tone: "error", title: "Couldn't publish", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {alert}
      {preview.issues.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink">Fix these before publishing:</p>
          <ul className="list-disc pl-5 text-sm text-danger">
            {preview.issues.map((i) => (
              <li key={i.id}>{`${i.productName}: ${i.message}`}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {preview.isEmpty ? (
            <p className="text-ink">This clears the fixture. Publish anyway?</p>
          ) : (
            <ul className="flex flex-col gap-1 text-ink">
              {preview.changes.length === 0 ? <li>No changes from the published version.</li> : preview.changes.map((c) => <li key={c.faceId}>{faceSummary(c)}</li>)}
            </ul>
          )}
          {/* A full publish ends any Quick Adjust (0.7.0.9 spec §6.3): say so before it does. */}
          {preview.adjustments.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-ink-muted">
              {preview.adjustments.flatMap((a) => a.changes.map((c, i) => <li key={`${a.adjustmentId}-${i}`}>{`Ends the Quick Adjust: ${endingWords(c)}`}</li>))}
            </ul>
          ) : null}
          {preview.soldOut.map((name) => (
            <p key={name} className="text-sm text-danger">
              {`${name} is sold out and is in this version.`}
            </p>
          ))}
          <p className="text-sm text-ink-muted">Becomes version {preview.nextNumber}.</p>
          <Input label="Summary (optional)" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} hint="Like “October denim reset”." />
          <Button onClick={() => publish(preview)} loading={busy} loadingText="Publishing…">
            {preview.isEmpty ? "Publish anyway" : `Publish to ${store}`}
          </Button>
        </>
      )}
    </div>
  );
}
