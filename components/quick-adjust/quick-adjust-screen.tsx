// Quick Adjust (0.7.0.9 spec §5.1): the published version drawn as read-only tiles, with marks. A tap on any tile opens the
// Adjust panel on it; a choice saves at once. No drag, resize, corner discs or + here: moving things is the monthly
// builder's job. The bar holds Undo, Redo, Compare, Publish (planograms.publish only) and Discard. A viewer's draft is a
// row on the server that the first choice opens; until then the page shows the published adjustment, if any.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddProductDialog } from "@/components/planograms/add-product-dialog";
import { DraftStatusLine } from "@/components/planograms/draft-status";
import { FaceSwitcher } from "@/components/planograms/face-switcher";
import { itemsFromSnapshot, startFace } from "@/components/planograms/grid-items";
import { PlanogramGrid } from "@/components/planograms/planogram-grid";
import type { PublishedVersion } from "@/lib/planograms/queries";
import { useUndoKeys } from "@/components/planograms/use-undo-keys";
import { useFaceView } from "@/components/planograms/use-face-view";
import { InfoPopover } from "@/components/ui/info-popover";
import { can, type Holder } from "@/lib/access/can";
import { targetKey, type AdjustmentState } from "@/lib/planograms/adjust";
import { combinedBlocks, singleBlock } from "@/lib/planograms/set-grid";
import type { PlanogramScope, ProductLook } from "@/lib/planograms/types";

import { AdjustBar } from "./adjust-bar";
import { AdjustCompare } from "./adjust-compare";
import { AdjustPanel } from "./adjust-panel";
import { DiscardAdjustment } from "./discard-adjustment";
import { wantVersionFocus } from "./focus-version";
import { adjustItems } from "./tile-marks";
import { choiceOf, refOf, useAdjustment } from "./use-adjustment";

type QuickAdjustScreenProps = {
  scope: PlanogramScope;
  version: PublishedVersion;
  draft: AdjustmentState | null;
  published: AdjustmentState | null;
  looks: Record<string, ProductLook>;
  /** ?product=: its first tile is selected and its panel open. */
  productId: string | null;
  member: Holder;
};

type Dialog = "compare" | "publish" | "discard" | "search" | null;

export function QuickAdjustScreen({ scope, version, draft: pageDraft, published, looks: pageLooks, productId, member }: QuickAdjustScreenProps) {
  const router = useRouter();
  const entries = version.placements;
  const a = useAdjustment({ fixtureId: scope.fixtureId, entries, draft: pageDraft, published, looks: pageLooks, onGone: () => router.refresh() });
  const first = productId ? entries.findIndex((e) => e.productId === productId) : -1;
  const [selectedId, setSelectedId] = useState<string | null>(first >= 0 ? `v-${first}` : null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const { face, slideFrom, showFace, onSwipe } = useFaceView(scope, () => startFace(scope, entries, null, productId));
  useUndoKeys(true, (direction) => void (direction === "undo" ? a.undo() : a.redo()));

  const items = adjustItems(entries, a.changes, a.looks);
  const shownFaces = scope.isSet ? scope.faces : [face];
  const layout = scope.isSet ? combinedBlocks(scope) : singleBlock(face);
  const at = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
  const entry = at >= 0 ? entries[at] : null;
  const current = entry ? choiceOf(a.changes, refOf(entry)) : ({ kind: "keep" } as const);
  const change = entry ? a.changes.find((c) => targetKey(c.target) === targetKey(entry)) : undefined;
  const chosen = change?.kind === "replace" ? { productId: change.replacement.productId, name: change.replacement.productName, styleNumber: change.replacement.styleNumber } : null;
  const fixtureId = scope.fixtureId;
  const hasDraft = a.draft !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AdjustBar
          status={a.status}
          panelOpen={entry !== null}
          canUndo={a.canUndo}
          canRedo={a.canRedo}
          onUndo={() => void a.undo()}
          onRedo={() => void a.redo()}
          canCompare={hasDraft || published !== null}
          onCompare={() => setDialog("compare")}
          canPublish={can(member, "planograms.publish")}
          canPublishNow={a.draft !== null && a.draft.changes.length > 0}
          onPublish={() => setDialog("publish")}
          canDiscard={hasDraft}
          onDiscard={() => setDialog("discard")}
        />
        <p className="flex items-center text-sm text-ink-muted">
          Quick Adjust on Version {version.number}
          <InfoPopover term="quickAdjust" />
        </p>
        <DraftStatusLine status={a.status} />
      </div>
      {scope.isSet ? null : <FaceSwitcher faces={scope.faces} value={face.faceId} onChange={showFace} />}
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PlanogramGrid
          layout={layout}
          items={items.filter((i) => shownFaces.some((f) => f.faceId === i.faceId))}
          label={`${scope.fixtureName}, ${scope.isRun ? "run" : scope.isSet ? "table set" : face.label}`}
          selectedId={selectedId}
          onSelect={setSelectedId}
          slideFrom={slideFrom}
          onSwipe={onSwipe}
        />
        <AdjustPanel
          fixtureId={fixtureId}
          open={entry !== null}
          original={entry ? itemsFromSnapshot([entry], a.looks, true)[0] : null}
          entry={entry}
          face={scope.faces.find((f) => f.faceId === entry?.faceId) ?? null}
          current={current}
          chosen={chosen}
          draftVersion={a.draft?.version ?? 0}
          status={a.status}
          onChoose={(choice) => entry && void a.choose(entry, choice)}
          onSearch={() => setDialog("search")}
          onClose={() => setSelectedId(null)}
        />
      </div>
      <AdjustCompare
        fixtureId={fixtureId}
        scope={scope}
        open={dialog === "compare" || dialog === "publish"}
        onOpenChange={(open) => !open && setDialog(null)}
        publishing={dialog === "publish"}
        onPublished={() => {
          wantVersionFocus();
          router.push(`/planograms/${fixtureId}`);
        }}
      />
      {a.draft ? <DiscardAdjustment open={dialog === "discard"} onOpenChange={(open) => !open && setDialog(null)} fixtureId={fixtureId} adjustmentId={a.draft.id} expectedVersion={a.draft.version} /> : null}
      <AddProductDialog
        open={dialog === "search" && entry !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        onPick={(product) => (entry ? a.choose(entry, { kind: "replace", productId: product.id }) : Promise.resolve(null))}
        title="Find another product"
        hint={entry ? `It goes where ${entry.productName} is, if it fits.` : undefined}
      />
      <p aria-live="polite" className="sr-only">
        {a.announcement}
      </p>
    </div>
  );
}
