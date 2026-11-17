// The map editor's bar, in the planogram corner bar's pattern: leave and where
// you are on the left, then in spaced groups on the right save status · Undo
// Redo │ + Add (A3, spec §10, DECISIONS 11-16).

"use client";

import { ArrowLeft, Redo2, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SaveStatus } from "./save-status";
import type { SaveStatus as Status } from "./use-map-editor";

type EditorTopBarProps = {
  title: string;
  inZone: boolean;
  status: Status;
  /** Why the last change was refused, in the status's place. */
  refusal: string | null;
  leaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onDone: () => void;
  onLeaveZone: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** The one + Add (A3). */
  add: React.ReactNode;
};

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-5" } as const;
// The gap inside a group is 4 px; between groups it's 12 + a hairline + 12.
const GROUP = "flex items-center gap-1";
const SPACED = `${GROUP} border-l border-line-subtle pl-3`;

export function EditorTopBar({ title, inZone, status, refusal, leaving, canUndo, canRedo, onDone, onLeaveZone, onUndo, onRedo, add }: EditorTopBarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-line-subtle bg-raised px-2 py-1">
      <div className={`${GROUP} min-w-0 flex-1`}>
        <Button icon variant="secondary" loading={leaving} loadingText="" aria-label={leaving ? "Saving…" : "Save and leave"} onClick={onDone}>
          <ArrowLeft {...ICON} />
        </Button>
        <h1 className="min-w-0 truncate pl-1 text-base font-semibold text-ink">{title}</h1>
        {inZone ? (
          <Button variant="secondary" icon aria-label="Back to the whole store" onClick={onLeaveZone}>
            <X {...ICON} />
          </Button>
        ) : null}
      </div>
      <div className={GROUP}>
        <div className="hidden sm:block">
          <SaveStatus status={status} refusal={refusal} />
        </div>
        <Button variant="ghost" icon aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2 {...ICON} />
        </Button>
        <Button variant="ghost" icon aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2 {...ICON} />
        </Button>
      </div>
      <div className={SPACED}>{add}</div>
    </header>
  );
}
