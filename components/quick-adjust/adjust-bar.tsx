// The adjust bar (0.7.0.9 spec §5.1), built as the planogram's corner bar is: spaced groups of 44 px icon buttons (R1)
// with their names in tooltips: save indicator · Undo Redo │ Compare │ Publish Discard. Publish is the one filled button
// and only for those who may publish (the server checks again). A control with nothing to do is aria-disabled, never
// disabled, so it keeps keyboard focus and can be named by a touch long-press; pressing it does nothing.

"use client";

import { Columns2, Redo2, Send, Trash2, Undo2 } from "lucide-react";

import { SaveIndicator } from "@/components/planograms/draft-status";
import type { DraftStatus } from "@/components/planograms/use-planogram-draft";
import { Button } from "@/components/ui/button";

type AdjustBarProps = {
  status: DraftStatus;
  /** The panel is open: it says Saved on its own line, so the indicator stops being a live region. */
  panelOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** There is a draft or a published Quick Adjust to compare. */
  canCompare: boolean;
  onCompare: () => void;
  /** Holds planograms.publish. */
  canPublish: boolean;
  /** The draft has a change to publish. */
  canPublishNow: boolean;
  onPublish: () => void;
  /** There is a draft to discard. */
  canDiscard: boolean;
  onDiscard: () => void;
};

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-5" } as const;
const GROUP = "flex items-center gap-1";
const SPACED = `${GROUP} border-l border-line-subtle pl-1.5 sm:pl-3`;
const QUIET = "aria-disabled:opacity-60";

export function AdjustBar({ status, panelOpen, canUndo, canRedo, onUndo, onRedo, canCompare, onCompare, canPublish, canPublishNow, onPublish, canDiscard, onDiscard }: AdjustBarProps) {
  return (
    <div data-adjust-bar className="flex w-full items-center justify-end gap-1 sm:gap-3 md:ml-auto md:w-auto">
      <div className={GROUP}>
        <SaveIndicator status={status} quiet={panelOpen} />
        <Button variant="ghost" icon aria-label="Undo" aria-disabled={!canUndo} className={QUIET} onClick={canUndo ? onUndo : undefined}>
          <Undo2 {...ICON} />
        </Button>
        <Button variant="ghost" icon aria-label="Redo" aria-disabled={!canRedo} className={QUIET} onClick={canRedo ? onRedo : undefined}>
          <Redo2 {...ICON} />
        </Button>
      </div>
      <div className={SPACED}>
        <Button variant="secondary" icon aria-label="Compare" aria-disabled={!canCompare} className={QUIET} onClick={canCompare ? onCompare : undefined}>
          <Columns2 {...ICON} />
        </Button>
      </div>
      <div className={SPACED}>
        {canPublish ? (
          <Button icon aria-label="Publish" aria-disabled={!canPublishNow} className={QUIET} onClick={canPublishNow ? onPublish : undefined}>
            <Send {...ICON} />
          </Button>
        ) : null}
        <Button variant="secondary" icon aria-label="Discard" aria-disabled={!canDiscard} className={QUIET} onClick={canDiscard ? onDiscard : undefined}>
          <Trash2 {...ICON} />
        </Button>
      </div>
    </div>
  );
}
