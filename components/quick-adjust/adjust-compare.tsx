// Compare (0.7.0.9 spec §5.3), one component used three ways: from the adjust bar (the draft, no button), from Publish
// (the same, with the Publish confirm button) and from the Published view's adjusted line (the published adjustment
// against its version). The word list comes first and is the text equivalent of the two grids: Before above After on a
// phone and tablet, side by side from 1024 px (two wall bays need about 960 px). A phone gets a full-height sheet, the
// rest a wide dialog. It reads fresh each time it opens, since another device may have changed the draft.

"use client";

import { useEffect, useRef, useState } from "react";

import { previewAdjustmentAction, publishAdjustmentAction } from "@/app/(app)/planograms/adjust-actions";
import { useActiveStoreName } from "@/components/shell/shell-context";
import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { changeWords } from "@/lib/planograms/adjust-words";
import type { AdjustPreview } from "@/lib/planograms/adjust-reads";
import { faceSummary } from "@/lib/planograms/diff";
import type { PlanogramScope } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

import { CompareFigure, drawnFaces } from "./compare-figure";
import { compareItems } from "./tile-marks";

type CompareBodyProps = { fixtureId: string; scope: PlanogramScope; publishing: boolean; store: string; onPublished: () => void };

function CompareBody({ fixtureId, scope, publishing, store, onPublished }: CompareBodyProps) {
  const [preview, setPreview] = useState<AdjustPreview | null | "loading">("loading");
  const [reloads, setReloads] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    previewAdjustmentAction(fixtureId)
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview(null));
    return () => {
      live = false;
    };
  }, [fixtureId, reloads]);

  // A refusal's words stay above whatever the reloaded preview shows.
  const alert = message ? (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  ) : null;
  if (preview === "loading") return <p className="text-ink-muted">Loading…</p>;
  if (preview === null) {
    return (
      <div className="flex flex-col gap-2">
        {alert}
        <p className="text-ink">There is no Quick Adjust to compare. Close and reload.</p>
      </div>
    );
  }

  async function publish(p: AdjustPreview) {
    setBusy(true);
    try {
      const reply = await publishAdjustmentAction(fixtureId, p.adjustmentId, p.version);
      if (reply.status === "saved") {
        toast({ tone: "success", title: reply.message });
        onPublished();
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

  const words = changeWords(preview.before, preview.after);
  const items = compareItems(preview.before, preview.after, preview.looks);
  const faces = drawnFaces(scope, preview.changes.map((c) => c.faceId));
  const canPublish = publishing && preview.kind === "draft" && words.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {alert}
      {preview.changes.length === 0 ? (
        <p className="text-ink">No changes from Version {preview.basedOnVersion}.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-ink">
          {preview.changes.map((c) => (
            <li key={c.faceId}>
              {faceSummary(c)}
              <ul className="list-disc pl-5 text-sm">
                {words.filter((w) => w.faceId === c.faceId).map((w) => (
                  <li key={w.text}>{w.text}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {/* Before above After, side by side only from 1024 px (lg). */}
      <div data-compare-grids className="grid gap-4 lg:grid-cols-2">
        <CompareFigure caption={`Before · Version ${preview.basedOnVersion}`} faces={faces} items={items.before} />
        <CompareFigure caption={preview.kind === "draft" ? "After" : "After · Quick Adjust"} faces={faces} items={items.after} />
      </div>
      {publishing
        ? preview.soldOutAfter.map((name) => (
            <p key={name} className="text-sm text-danger">
              {`${name} is sold out and is still on the floor.`}
            </p>
          ))
        : null}
      {publishing && !canPublish ? <p className="text-ink-muted">{preview.kind === "draft" ? "Nothing to publish yet." : "There is no draft to publish."}</p> : null}
      {canPublish ? (
        <Button onClick={() => publish(preview)} loading={busy} loadingText="Publishing…">
          {`Publish to ${store}`}
        </Button>
      ) : null}
    </div>
  );
}

type AdjustCompareProps = {
  fixtureId: string;
  scope: PlanogramScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows the Publish button; without it Compare only looks. */
  publishing?: boolean;
  /** A publish went through: the dialog has closed, and the screen goes on from here. */
  onPublished?: () => void;
};

export function AdjustCompare({ fixtureId, scope, open, onOpenChange, publishing = false, onPublished }: AdjustCompareProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const store = useActiveStoreName() ?? "this store";
  // A publish that went through takes the opener away: focus is not sent back to it.
  const published = useRef(false);
  useEffect(() => {
    if (open) published.current = false;
  }, [open]);
  const body = open ? (
    <CompareBody
      fixtureId={fixtureId}
      scope={scope}
      publishing={publishing}
      store={store}
      onPublished={() => {
        published.current = true;
        onOpenChange(false);
        onPublished?.();
      }}
    />
  ) : null;
  const title = publishing ? `Publish to ${store}?` : "Compare";
  const keepFocus = (event: Event) => {
    if (published.current) event.preventDefault();
  };
  if (isPhone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title} tall onCloseAutoFocus={keepFocus}>
        {body}
      </BottomSheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={publishing ? "What this Quick Adjust puts on the floor." : "The floor before and after the Quick Adjust."} wide onCloseAutoFocus={keepFocus}>
      {body}
    </Dialog>
  );
}
