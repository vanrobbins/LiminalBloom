// The planogram's corner bar (0.7.0.5 spec §2.1), one row at the top right of
// the status row at every size, in three spaced groups: save indicator · Undo
// Redo │ + │ Publish Discard ⋯. Every control is an icon button (44 px) with its
// name in a tooltip; Publish is the one filled button, at every size an icon.
// Undo and Redo are ghosts (no box). Discard draft is the visible trash beside
// Publish; ⋯ (corner-menu.tsx) holds the due date and Version history.
// Add shows while a draft or the latest version is what's on screen (with no
// draft, the add starts one); the rest wait for a draft being edited.
// Publish and Discard open the dialogs they always did.

"use client";

import { Plus, Redo2, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { discardDraftAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PlanogramRow } from "@/lib/planograms/queries";
import { toast } from "@/lib/toast";

import { CornerMenu } from "./corner-menu";
import { SaveIndicator } from "./draft-status";
import { PublishDialog } from "./publish-dialog";
import type { DraftStatus } from "./use-planogram-draft";

type CornerBarProps = {
  fixtureId: string;
  row: PlanogramRow | null;
  /** A draft exists and is the one being edited: Undo, Redo, Publish and Discard belong to it. */
  editing: boolean;
  draftVersion: number | null;
  /** The save state; only while editing. */
  status: DraftStatus | null;
  /** A draft or the latest version is shown, and the person may draft. */
  canAdd: boolean;
  onAdd: () => void;
  canPublish: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  dueDate: string | null;
  /** Setting the due date is publishing's: the ⋯ offers it only with that switch. */
  canSetDueDate: boolean;
  /** The draft was published or discarded. */
  onLeave: () => void;
};

const ICON = {
  "aria-hidden": true,
  strokeWidth: 1.75,
  className: "size-5",
} as const;
// The gap inside a group is 4 px; between groups it's 12 + a hairline + 12 (4 + hairline + 6 on a phone, so all six controls fit 360 px).
const GROUP = "flex items-center gap-1";
const SPACED = `${GROUP} border-l border-line-subtle pl-1.5 sm:pl-3`;

export function CornerBar({ fixtureId, row, editing, draftVersion, status, canAdd, onAdd, canPublish, canUndo, canRedo, onUndo, onRedo, dueDate, canSetDueDate, onLeave }: CornerBarProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const trash = useRef<HTMLButtonElement>(null);
  // A discard that went through takes the ⋯ away on the reload that follows, whenever that lands.
  const discarded = useRef(false);

  async function discard() {
    setBusy(true);
    try {
      const reply = await discardDraftAction(fixtureId, draftVersion ?? row?.version ?? 0);
      toast({
        tone: reply.status === "saved" ? "success" : "error",
        title: reply.message,
      });
      discarded.current = reply.status === "saved";
      setDiscarding(false);
      if (reply.status === "saved") onLeave();
      else router.refresh();
    } catch {
      // Nothing was discarded: the dialog stays for another try.
      toast({
        tone: "error",
        title: "Couldn't discard",
        description: "Check the connection and try again.",
      });
      setBusy(false);
    }
    // Otherwise busy holds while the dialog closes and until it is opened again, so a click on its way out can't confirm twice.
  }

  const hasHistory = row?.publishedVersion != null;
  const hasMenu = canSetDueDate || hasHistory;
  if (!editing && !canAdd && !hasMenu) return null;

  return (
    <>
      {/* On a phone it takes a row of its own above the rest of the status row, right-aligned; from tablet width it ends the one row. */}
      <div data-corner-bar className="order-first flex w-full items-center justify-end gap-1 sm:gap-3 md:order-none md:ml-auto md:w-auto">
        {editing ? (
          <div className={GROUP}>
            {status ? <SaveIndicator status={status} /> : null}
            <Button variant="ghost" icon aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
              <Undo2 {...ICON} />
            </Button>
            <Button variant="ghost" icon aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
              <Redo2 {...ICON} />
            </Button>
          </div>
        ) : null}
        {canAdd ? (
          <div className={editing ? SPACED : GROUP}>
            <Button variant="secondary" icon aria-label="Add product" onClick={onAdd}>
              <Plus {...ICON} />
            </Button>
          </div>
        ) : null}
        {editing || hasMenu ? (
          <div className={editing || canAdd ? SPACED : GROUP}>
            {editing && canPublish ? (
              <Button icon aria-label="Publish" onClick={() => setPublishing(true)}>
                <Send {...ICON} />
              </Button>
            ) : null}
            {editing ? (
              <Button
                ref={trash}
                variant="secondary"
                icon
                aria-label="Discard draft"
                onClick={() => {
                  setBusy(false);
                  discarded.current = false;
                  setDiscarding(true);
                }}
              >
                <Trash2 {...ICON} />
              </Button>
            ) : null}
            <CornerMenu fixtureId={fixtureId} dueDate={dueDate} canSetDueDate={canSetDueDate} hasHistory={hasHistory} />
          </div>
        ) : null}
      </div>
      <PublishDialog open={publishing} onOpenChange={setPublishing} fixtureId={fixtureId} onPublished={onLeave} />
      <Dialog
        open={discarding}
        onOpenChange={(open) => {
          if (!busy) setDiscarding(open);
        }}
        title="Discard this draft?"
        description="Every change since it started is lost. The published planogram stays as it is."
        // Focus goes back to the trash button, or, after a discard that went through (it is on its way out),
        // to the page's main area as a removed tile's does.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (discarded.current ? document.getElementById("content") : trash.current)?.focus();
        }}
      >
        <Button variant="danger" onClick={discard} loading={busy} loadingText="Discarding…">
          Discard draft
        </Button>
      </Dialog>
    </>
  );
}
