// Compare, until the full view lands (0.7.0.9 task 6b replaces this): the change list in words, from the same
// preview the full view uses. Open to anyone who can see the planogram.

"use client";

import { Columns2 } from "lucide-react";
import { useEffect, useState } from "react";

import { previewAdjustmentAction } from "@/app/(app)/planograms/adjust-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { AdjustPreview } from "@/lib/planograms/adjust-reads";
import { faceSummary } from "@/lib/planograms/diff";

export function ComparePlaceholder({ fixtureId }: { fixtureId: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AdjustPreview | null | "loading">("loading");

  useEffect(() => {
    if (!open) return;
    let live = true;
    previewAdjustmentAction(fixtureId)
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview(null));
    return () => {
      live = false;
    };
  }, [open, fixtureId]);

  const changes = preview && preview !== "loading" ? preview.changes : [];
  return (
    <>
      <Button icon variant="secondary" onClick={() => {
          setPreview("loading");
          setOpen(true);
        }} aria-label="Compare Quick Adjust">
        <Columns2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Compare" description="What the Quick Adjust changes from the published version.">
        {preview === "loading" ? (
          <p className="text-ink-muted">Loading…</p>
        ) : changes.length === 0 ? (
          <p className="text-ink">Nothing to compare.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-ink">
            {changes.map((c) => (
              <li key={c.faceId}>{faceSummary(c)}</li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
