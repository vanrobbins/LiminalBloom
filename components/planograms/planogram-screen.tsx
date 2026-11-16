// Planogram Detail's body (spec §5.2–5.3; Part 2 §4): published, draft or a
// past version, face by face (a table set as one combined view). The draft and
// the latest version are editable on the grid: tap to select, then drag,
// resize, use the corner discs (trash, pencil) or the keys; with no draft the first
// change starts one. One status row above the grid holds the version line,
// Draft | Published, the due date and the actions (UX audit U20); on a phone
// the corner bar (corner-bar.tsx) ends that row; + or a first change starts a draft.
// With nothing yet, Start planogram sits in the empty box (U19).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { can, type Holder } from "@/lib/access/can";
import type { PlanogramRow, PublishedVersion } from "@/lib/planograms/queries";
import { draftIssues } from "@/lib/planograms/rules";
import { combinedBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { DraftState, PlanogramScope, ProductLook } from "@/lib/planograms/types";

import { AddProductDialog } from "./add-product-dialog";
import { CornerBar } from "./corner-bar";
import { itemsFromDraft, itemsFromSnapshot, startFace } from "./grid-items";
import { PastVersion } from "./past-version";
import { PlanogramBody } from "./planogram-body";
import { StartPlanogram } from "./start-planogram";
import { StatusRow } from "./status-row";
import { useBuilder } from "./use-builder";
import { useFaceView } from "./use-face-view";
import { spotWords, usePlacementActions } from "./use-placement-actions";
import { usePlanogramDraft } from "./use-planogram-draft";
import { useSelection } from "./use-selection";

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
  /** Whose switches decide which controls show; the server checks them again. */
  member: Holder;
};

export function PlanogramScreen({ scope, row, latest, draft: pageDraft, viewing, looks, highlightProductId, dueDate, today, member }: PlanogramScreenProps) {
  const router = useRouter();
  const canDraft = can(member, "planograms.draft");
  // A draft is for those who may draft: without the switch the page reads as the published planogram only.
  const initialDraft = canDraft ? pageDraft : null;
  const { draft, status, save, adopt, leave, onLeaveRef, onTakeRef } = usePlanogramDraft(scope.fixtureId, initialDraft, () => router.refresh());
  const [view, setView] = useState<"draft" | "published">(initialDraft ? "draft" : "published");
  const { face, slideFrom, showFace, onSwipe } = useFaceView(scope, () => startFace(scope, (viewing ?? latest)?.placements ?? [], viewing ? null : initialDraft, highlightProductId));
  const [adding, setAdding] = useState(false);

  const shownFaces = scope.isSet ? scope.faces : [face];
  const layout = scope.isSet ? combinedBlocks(scope) : singleBlock(face);
  const isEditing = draft !== null && view === "draft" && viewing === null;
  // The latest version is movable too: its first change starts a draft (Part 2 spec §4 "Draft").
  const canMove = canDraft && viewing === null && (isEditing || (draft === null && latest !== null));
  const placements = draft?.placements ?? [];
  const issues = isEditing ? draftIssues(placements, scope.faces) : new Map<string, string>();
  const items = isEditing ? itemsFromDraft(placements) : itemsFromSnapshot((viewing ?? latest)?.placements ?? [], looks);
  const busy = status.kind === "saving";
  const isEmpty = !latest && !draft;
  const { selectedId, setSelectedId, sheetId, openSheet, select, onTile, editNumbers } = useSelection(isEditing, items);

  const builder = useBuilder({
    fixtureId: scope.fixtureId,
    draft,
    // Ctrl+Z only on the draft being edited, never on Published or a past version.
    enabled: isEditing,
    expectedVersion: row?.version ?? null,
    save, adopt, onLeaveRef, onTakeRef,
    onStale: leave,
    // A draft this device started or another device's it adopted: either way it's now the one shown.
    onStarted: () => {
      setView("draft");
      openSheet(null);
    },
    describe: (fields) => spotWords(scope.faces, fields),
    reveal: (fields) => {
      if (scope.isSet || fields.faceId === face.faceId) return null;
      showFace(fields.faceId);
      return scope.faces.find((f) => f.faceId === fields.faceId)?.label ?? null;
    },
  });

  // Draft and Published are different placements: the open sheet and the mark don't carry over.
  function showView(next: "draft" | "published") {
    setView(next);
    select(null);
  }

  const actions = usePlacementActions({ scope, face, layout, placements, items, isEditing, canMove, selectedId, builder, setSelectedId, select, showFace, editNumbers });

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
      onMoveToFace={actions.moveToFace}
      onReorder={actions.gridBuilder ? actions.reorder : undefined}
    />
  );

  if (viewing) {
    return (
      <PastVersion fixtureId={scope.fixtureId} latest={latest} number={viewing.number}>
        {body}
      </PastVersion>
    );
  }

  const cornerBar = canDraft ? (
    <CornerBar
      fixtureId={scope.fixtureId}
      row={row}
      editing={isEditing}
      draftVersion={draft?.planogramVersion ?? null}
      status={isEditing ? status : null}
      canAdd={canMove}
      onAdd={() => setAdding(true)}
      canPublish={can(member, "planograms.publish")}
      canUndo={builder.canUndo}
      canRedo={builder.canRedo}
      onUndo={() => void builder.undo()}
      onRedo={() => void builder.redo()}
      onLeave={leave}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {isEmpty ? null : (
        <StatusRow fixtureId={scope.fixtureId} latest={latest} hasDraft={draft !== null} view={view} onView={showView} dueDate={dueDate} canSetDueDate={can(member, "planograms.publish")} today={today} status={isEditing ? status : null}>
          {cornerBar}
        </StatusRow>
      )}
      {isEmpty ? (
        <div data-empty className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line p-8">
          <p className="text-lg font-semibold text-ink">No planogram yet</p>
          {canDraft ? <p className="text-sm text-ink-muted">A draft starts from what&apos;s on the floor now.</p> : null}
          {canDraft ? <StartPlanogram fixtureId={scope.fixtureId} row={row} /> : null}
        </div>
      ) : (
        body
      )}
      {canMove ? <AddProductDialog open={adding} onOpenChange={setAdding} onPick={actions.addProduct} onCloseAutoFocus={actions.focusAdded} /> : null}
      <p aria-live="polite" className="sr-only">
        {builder.announcement}
      </p>
    </div>
  );
}
