// Planogram Detail's body (spec §5.2–5.3): published, draft or a past version,
// face by face (a table set as one combined view), and the plain editor.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useState } from "react";

import { startDraftAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import type { PlanogramRow, PublishedVersion } from "@/lib/planograms/queries";
import { draftIssues } from "@/lib/planograms/rules";
import { setBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { DraftState, PlanogramScope } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

import { AddProductDialog } from "./add-product-dialog";
import { DraftBar } from "./draft-bar";
import { DraftStatusLine } from "./draft-status";
import { itemsFromDraft, itemsFromSnapshot, startFace } from "./grid-items";
import { PlanogramBody } from "./planogram-body";
import { usePlanogramDraft } from "./use-planogram-draft";

type PlanogramScreenProps = {
  scope: PlanogramScope;
  row: PlanogramRow | null;
  latest: PublishedVersion | null;
  draft: DraftState | null;
  viewing: PublishedVersion | null;
  highlightProductId: string | null;
};

export function PlanogramScreen({ scope, row, latest, draft: initialDraft, viewing, highlightProductId }: PlanogramScreenProps) {
  const router = useRouter();
  const { draft, status, save } = usePlanogramDraft(scope.fixtureId, initialDraft, () => router.refresh());
  const [view, setView] = useState<"draft" | "published">(initialDraft ? "draft" : "published");
  const [faceId, setFaceId] = useState(() => startFace(scope, (viewing ?? latest)?.placements ?? [], initialDraft, highlightProductId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ faceId: string; col: number; row: number } | null | "open">(null);
  const [starting, setStarting] = useState(false);

  const face = scope.faces.find((f) => f.faceId === faceId) ?? scope.faces[0];
  const shownFaces = scope.isSet ? scope.faces : [face];
  const layout = scope.isSet ? setBlocks(scope.faces) : singleBlock(face);
  const isEditing = draft !== null && view === "draft" && viewing === null;
  const placements = draft?.placements ?? [];
  const issues = isEditing ? draftIssues(placements, scope.faces) : new Map<string, string>();
  const items = isEditing ? itemsFromDraft(placements) : itemsFromSnapshot((viewing ?? latest)?.placements ?? []);
  const selected = selectedId ? (placements.find((p) => p.id === selectedId) ?? null) : null;
  const busy = status.kind === "saving";

  async function start() {
    setStarting(true);
    try {
      const reply = await startDraftAction(scope.fixtureId, row?.version ?? null);
      if (reply.status === "refused") toast({ tone: "error", title: reply.message });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't start the draft", description: "Check the connection and try again." });
    } finally {
      setStarting(false);
    }
  }

  const body = (
    <PlanogramBody
      scope={scope}
      face={face}
      shownFaces={shownFaces}
      layout={layout}
      items={items}
      issues={issues}
      isEditing={isEditing}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      highlightProductId={highlightProductId}
      placements={placements}
      selected={selected}
      busy={busy}
      onFace={setFaceId}
      onAdd={setAdding}
      save={save}
    />
  );

  if (viewing) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded border border-line bg-raised px-4 py-3 text-ink">
          Version {viewing.number}, read-only.{" "}
          <Link href={`/planograms/${scope.fixtureId}`} className="text-brand-strong underline underline-offset-4">
            Back to the current planogram
          </Link>
        </p>
        {body}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {draft ? (
        <div role="group" aria-label="Show" className="flex gap-2">
          {(["draft", "published"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className="inline-flex min-h-11 items-center gap-1 rounded border border-line bg-raised px-4 text-sm text-ink aria-pressed:border-ink aria-pressed:bg-brand aria-pressed:font-semibold aria-pressed:text-on-brand"
            >
              {view === v ? <Check aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
              {v === "draft" ? "Draft" : "Published"}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={start} loading={starting} loadingText="Starting…">
            Start draft
          </Button>
          <p className="text-sm text-ink-muted">{latest ? `From version ${latest.number}.` : "From what's on the floor now."}</p>
        </div>
      )}
      {isEditing ? (
        <>
          <DraftBar fixtureId={scope.fixtureId} draftVersion={draft.planogramVersion} onAdd={() => setAdding("open")} />
          <DraftStatusLine status={status} />
        </>
      ) : null}
      {body}
      {isEditing ? (
        <AddProductDialog
          open={adding !== null}
          onOpenChange={(open) => (open ? null : setAdding(null))}
          faces={scope.faces}
          startAt={adding === "open" ? null : adding}
          others={placements}
          busy={busy}
          onAdd={(productId, fields) => save({ kind: "add", productId, fields })}
        />
      ) : null}
    </div>
  );
}
