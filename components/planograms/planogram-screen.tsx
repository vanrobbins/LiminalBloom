// Planogram Detail's body (spec §5.2–5.3): published, draft or a past version,
// face by face (a table set as one combined view), and the plain editor. A
// status row (Draft | Published, due date, saving) sits above the grid, and
// the actions in a bar below it: sticky on a phone (spec §4.4).

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlanogramRow, PublishedVersion } from "@/lib/planograms/queries";
import { draftIssues } from "@/lib/planograms/rules";
import { setBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { DraftState, PlanogramScope, ProductLook } from "@/lib/planograms/types";

import { AddProductDialog } from "./add-product-dialog";
import { DraftBar } from "./draft-bar";
import { DraftStatusLine } from "./draft-status";
import { DueDateChip } from "./due-date-chip";
import { swipeTarget } from "./face-swipe";
import { itemsFromDraft, itemsFromSnapshot, startFace } from "./grid-items";
import { PlanogramBody } from "./planogram-body";
import { usePlanogramDraft } from "./use-planogram-draft";
import type { Edges } from "./use-scroll-edges";

type PlanogramScreenProps = {
  scope: PlanogramScope;
  row: PlanogramRow | null;
  latest: PublishedVersion | null;
  draft: DraftState | null;
  viewing: PublishedVersion | null;
  looks: Record<string, ProductLook>;
  highlightProductId: string | null;
  dueDate: string | null;
  today: string;
};

export function PlanogramScreen({ scope, row, latest, draft: initialDraft, viewing, looks, highlightProductId, dueDate, today }: PlanogramScreenProps) {
  const router = useRouter();
  const { draft, status, save } = usePlanogramDraft(scope.fixtureId, initialDraft, () => router.refresh());
  const [view, setView] = useState<"draft" | "published">(initialDraft ? "draft" : "published");
  const [faceId, setFaceId] = useState(() => startFace(scope, (viewing ?? latest)?.placements ?? [], initialDraft, highlightProductId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ faceId: string; col: number; row: number } | null | "open">(null);
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);

  const face = scope.faces.find((f) => f.faceId === faceId) ?? scope.faces[0];
  const shownFaces = scope.isSet ? scope.faces : [face];
  const layout = scope.isSet ? setBlocks(scope.faces) : singleBlock(face);
  const isEditing = draft !== null && view === "draft" && viewing === null;
  const placements = draft?.placements ?? [];
  const issues = isEditing ? draftIssues(placements, scope.faces) : new Map<string, string>();
  const items = isEditing ? itemsFromDraft(placements) : itemsFromSnapshot((viewing ?? latest)?.placements ?? [], looks);
  const selected = sheetId ? (placements.find((p) => p.id === sheetId) ?? null) : null;
  const busy = status.kind === "saving";
  const isEmpty = !latest && !draft;

  // A read-only sheet whose product is no longer shown closes, rather than
  // standing open and empty. (While editing, the editor says "Removed on
  // another device" instead.) Adjusted during render, as React allows for own state.
  if (sheetId !== null && !isEditing && !items.some((i) => i.id === sheetId)) setSheetId(null);

  // Draft and Published are different placements: the open sheet and the mark don't carry over.
  function showView(next: "draft" | "published") {
    setView(next);
    setSheetId(null);
    setSelectedId(null);
  }

  const faceIds = scope.faces.map((f) => f.faceId);
  function showFace(id: string, from?: "left" | "right") {
    setSlideFrom(from ?? (faceIds.indexOf(id) > faceIds.indexOf(face.faceId) ? "right" : "left"));
    setFaceId(id);
  }
  function onSwipe(gesture: { dx: number; dy: number; edges: Edges }) {
    if (scope.isSet) return;
    const target = swipeTarget(faceIds, face.faceId, gesture);
    if (target) showFace(target.faceId, target.from);
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
      sheetId={sheetId}
      setSheetId={setSheetId}
      highlightProductId={highlightProductId}
      placements={placements}
      selected={selected}
      busy={busy}
      slideFrom={slideFrom}
      onSwipe={onSwipe}
      onFace={showFace}
      onAdd={setAdding}
      save={save}
    />
  );

  if (viewing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded border border-line bg-raised px-4 py-3">
          <p className="text-ink">Version {viewing.number}, read-only.</p>
          <Button asChild variant="secondary">
            <Link href={`/planograms/${scope.fixtureId}`}>Back to the current planogram</Link>
          </Button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {draft ? (
          <SegmentedControl
            label="Show"
            options={[
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
            ]}
            value={view}
            onChange={showView}
          />
        ) : null}
        <DueDateChip fixtureId={scope.fixtureId} dueDate={dueDate} today={today} />
        {isEditing ? <DraftStatusLine status={status} /> : null}
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-line p-8">
          <p className="text-lg font-semibold text-ink">No planogram yet</p>
          <p className="text-sm text-ink-muted">Start a draft: it begins from what&apos;s on the floor now.</p>
        </div>
      ) : (
        body
      )}
      <DraftBar
        fixtureId={scope.fixtureId}
        row={row}
        hasDraft={draft !== null}
        isEditing={isEditing}
        draftVersion={draft?.planogramVersion ?? null}
        latestNumber={latest?.number ?? null}
        onAdd={() => setAdding("open")}
      />
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
