// The planogram's corner bar (0.7.0.5 spec §2.1), one row at the top right of
// the status row at every size, in three spaced groups: save indicator · Undo
// Redo │ + │ Publish ⋯. Every control is an icon button (44 px) with its name
// in a tooltip; Publish is the one filled button and shows its word from 768 px.
// Add shows while a draft or the latest version is what's on screen (with no
// draft, the add starts one); the rest wait for a draft being edited.
// Publish and Discard open the dialogs they always did.

"use client";

import { MoreHorizontal, Plus, Redo2, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { discardDraftAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PlanogramRow } from "@/lib/planograms/queries";
import { toast } from "@/lib/toast";

import { SaveIndicator } from "./draft-status";
import { PublishDialog } from "./publish-dialog";
import type { DraftStatus } from "./use-planogram-draft";

type CornerBarProps = {
  fixtureId: string;
  row: PlanogramRow | null;
  /** A draft exists and is the one being edited: Undo, Redo, Publish and ⋯ belong to it. */
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
  /** The draft was published or discarded. */
  onLeave: () => void;
};

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-5" } as const;
// The gap inside a group is 4 px; between groups it's 12 + a hairline + 12.
const GROUP = "flex items-center gap-1";
const SPACED = `${GROUP} border-l border-line-subtle pl-3`;

export function CornerBar({ fixtureId, row, editing, draftVersion, status, canAdd, onAdd, canPublish, canUndo, canRedo, onUndo, onRedo, onLeave }: CornerBarProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const more = useRef<HTMLButtonElement>(null);

  async function discard() {
    setBusy(true);
    try {
      const reply = await discardDraftAction(fixtureId, draftVersion ?? row?.version ?? 0);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      setDiscarding(false);
      if (reply.status === "saved") onLeave();
      else router.refresh();
    } catch {
      // Nothing was discarded: the dialog stays for another try.
      toast({ tone: "error", title: "Couldn't discard", description: "Check the connection and try again." });
      setBusy(false);
    }
    // Otherwise busy holds while the dialog closes and until it is opened again, so a click on its way out can't confirm twice.
  }

  if (!editing && !canAdd) return null;

  return (
    <>
      {/* On a phone it takes a row of its own above the rest of the status row, right-aligned; from tablet width it ends the one row. */}
      <div data-corner-bar className="order-first flex w-full items-center justify-end gap-3 md:order-none md:ml-auto md:w-auto">
        {editing ? (
          <div className={GROUP}>
            {status ? <SaveIndicator status={status} /> : null}
            <Button variant="secondary" icon aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
              <Undo2 {...ICON} />
            </Button>
            <Button variant="secondary" icon aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
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
        {editing ? (
          <div className={SPACED}>
            {canPublish ? (
              <Button icon aria-label="Publish…" className="md:w-auto md:px-4" onClick={() => setPublishing(true)}>
                <Send {...ICON} />
                <span className="hidden md:inline">Publish</span>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button ref={more} variant="secondary" icon aria-label="More draft actions">
                  <MoreHorizontal {...ICON} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setBusy(false);
                    setDiscarding(true);
                  }}
                >
                  <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  Discard draft…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        // Opened from a menu item that is gone by now, so Radix has nothing to give focus back to: it goes to the ⋯,
        // or, once a discard has taken the ⋯ away, to the page's main area (as a removed tile's does) rather than the page top.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (more.current ?? document.getElementById("content"))?.focus();
        }}
      >
        <Button variant="danger" onClick={discard} loading={busy} loadingText="Discarding…">
          Discard draft
        </Button>
      </Dialog>
    </>
  );
}
