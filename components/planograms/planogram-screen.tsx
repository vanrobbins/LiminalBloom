// Planogram Detail's body (spec §5.2–5.3; Part 2 §4): published, draft or a
// past version, face by face (a table set as one combined view). The draft and
// the latest version are editable on the grid: tap to select, then drag,
// resize, use the selection bar or the arrow keys; with no draft the first
// change starts one. A status row sits above the grid and the actions in a bar
// below it: sticky on a phone, where the selection bar takes its place.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlanogramRow, PublishedVersion } from "@/lib/planograms/queries";
import { draftIssues } from "@/lib/planograms/rules";
import { combinedBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { DraftState, PlanogramScope, ProductLook } from "@/lib/planograms/types";

import { AddProductDialog } from "./add-product-dialog";
import { DraftBar } from "./draft-bar";
import { DraftStatusLine } from "./draft-status";
import { DueDateChip } from "./due-date-chip";
import { swipeTarget } from "./face-swipe";
import { itemsFromDraft, itemsFromSnapshot, startFace } from "./grid-items";
import { MoveToFaceDialog } from "./move-to-face-dialog";
import { PlanogramBody } from "./planogram-body";
import { SelectionBar } from "./selection-bar";
import { useBuilder } from "./use-builder";
import { spotWords, usePlacementActions } from "./use-placement-actions";
import { usePlanogramDraft } from "./use-planogram-draft";
import { useSelection } from "./use-selection";
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
  const { draft, status, save, adopt } = usePlanogramDraft(scope.fixtureId, initialDraft, () => router.refresh());
  const [view, setView] = useState<"draft" | "published">(initialDraft ? "draft" : "published");
  const [faceId, setFaceId] = useState(() => startFace(scope, (viewing ?? latest)?.placements ?? [], initialDraft, highlightProductId));
  const [adding, setAdding] = useState(false);
  const [movingFace, setMovingFace] = useState(false);
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);

  const face = scope.faces.find((f) => f.faceId === faceId) ?? scope.faces[0];
  const shownFaces = scope.isSet ? scope.faces : [face];
  const layout = scope.isSet ? combinedBlocks(scope) : singleBlock(face);
  const isEditing = draft !== null && view === "draft" && viewing === null;
  // The latest version is movable too: its first change starts a draft (Part 2 spec §4 "Draft").
  const canMove = viewing === null && (isEditing || (draft === null && latest !== null));
  const placements = draft?.placements ?? [];
  const issues = isEditing ? draftIssues(placements, scope.faces) : new Map<string, string>();
  const items = isEditing ? itemsFromDraft(placements) : itemsFromSnapshot((viewing ?? latest)?.placements ?? [], looks);
  const busy = status.kind === "saving";
  const isEmpty = !latest && !draft;
  const { selectedId, setSelectedId, sheetId, sheetMode, openSheet, select, onTile, editNumbers } = useSelection(isEditing, items);
  const selectedPlacement = isEditing ? (placements.find((p) => p.id === selectedId) ?? null) : null;

  const builder = useBuilder({
    fixtureId: scope.fixtureId,
    draft,
    // Ctrl+Z only on the draft being edited, never on Published or a past version.
    enabled: isEditing,
    expectedVersion: row?.version ?? null,
    save,
    adopt,
    onStale: () => router.refresh(),
    // A draft this device started or another device's it adopted: either way it's now the one shown.
    onStarted: () => {
      setView("draft");
      openSheet(null);
    },
    describe: (fields) => spotWords(scope.faces, fields),
  });

  // Draft and Published are different placements: the open sheet and the mark don't carry over.
  function showView(next: "draft" | "published") {
    setView(next);
    select(null);
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

  const actions = usePlacementActions({ scope, face, layout, placements, items, isEditing, canMove, selectedPlacement, builder, save, setSelectedId, select, showFace });

  function chooseFace(id: string) {
    setMovingFace(false);
    actions.moveToFace(id);
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
      setSelectedId={select}
      sheetId={sheetId}
      sheetMode={sheetMode}
      openSheet={openSheet}
      highlightProductId={highlightProductId}
      placements={placements}
      busy={busy}
      slideFrom={slideFrom}
      builder={actions.gridBuilder}
      onTile={onTile}
      onSwipe={onSwipe}
      onFace={showFace}
      onEdit={actions.edit}
      onRemove={actions.remove}
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
          <span className="inline-flex max-w-full items-center gap-1">
            <SegmentedControl
              label="Show"
              options={[
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ]}
              value={view}
              onChange={showView}
            />
            <InfoPopover term="draft" />
          </span>
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
      {selectedPlacement ? (
        <SelectionBar
          name={selectedPlacement.productName}
          canMoveFace={scope.faces.length > 1}
          busy={busy}
          onDetails={() => openSheet(selectedPlacement.id, "details")}
          onEdit={() => editNumbers(selectedPlacement.id)}
          onMoveFace={() => setMovingFace(true)}
          onRemove={() => actions.remove(selectedPlacement)}
        />
      ) : null}
      <DraftBar
        fixtureId={scope.fixtureId}
        row={row}
        hasDraft={draft !== null}
        isEditing={isEditing}
        draftVersion={draft?.planogramVersion ?? null}
        latestNumber={latest?.number ?? null}
        onAdd={() => setAdding(true)}
        yieldOnPhone={selectedPlacement !== null}
      />
      {isEditing ? <AddProductDialog open={adding} onOpenChange={setAdding} onPick={actions.addProduct} onCloseAutoFocus={actions.focusAdded} /> : null}
      {selectedPlacement ? (
        <MoveToFaceDialog open={movingFace} onOpenChange={setMovingFace} faces={scope.faces} currentFaceId={selectedPlacement.faceId} onChoose={chooseFace} />
      ) : null}
      <p aria-live="polite" className="sr-only">
        {builder.announcement}
      </p>
    </div>
  );
}
