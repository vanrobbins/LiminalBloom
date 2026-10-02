// Done, where you are, undo/redo and save status (spec §10).

"use client";

import { Redo2, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SaveStatus } from "./save-status";
import type { SaveStatus as Status } from "./use-map-editor";

type EditorTopBarProps = {
  title: string;
  inZone: boolean;
  status: Status;
  leaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onDone: () => void;
  onLeaveZone: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function EditorTopBar({ title, inZone, status, leaving, canUndo, canRedo, onDone, onLeaveZone, onUndo, onRedo }: EditorTopBarProps) {
  return (
    <header className="flex items-center gap-2 border-b border-line-subtle bg-raised px-2 py-1">
      <Button variant="secondary" loading={leaving} loadingText="Saving…" onClick={onDone}>
        Done
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-ink">{title}</h1>
      {inZone ? (
        <Button variant="secondary" icon aria-label="Back to the whole store" onClick={onLeaveZone}>
          <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      ) : null}
      <div className="hidden sm:block">
        <SaveStatus status={status} />
      </div>
      <Button variant="secondary" icon aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      <Button variant="secondary" icon aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
    </header>
  );
}
