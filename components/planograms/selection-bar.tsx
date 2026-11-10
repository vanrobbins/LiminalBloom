// What the selected tile can do (Part 2 spec §4 "Draft"): Details · Edit
// numbers · Move to face… · Remove. On a phone it takes the draft bar's place
// above the tabs; inline on tablet and desktop, beside the draft bar. Sharing
// rail space, it adds Move forward / Move back (hung layers).

"use client";

import { ArrowDown, ArrowRightLeft, ArrowUp, Info, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type SelectionBarProps = {
  name: string;
  canMoveFace: boolean;
  busy: boolean;
  onDetails: () => void;
  onEdit: () => void;
  onMoveFace: () => void;
  onRemove: () => void;
  /** Only while it shares rail space; null when it's already at that end. */
  layers?: { onForward: (() => void) | null; onBack: (() => void) | null };
};

const ICON = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4" } as const;

export function SelectionBar({ name, canMoveFace, busy, onDetails, onEdit, onMoveFace, onRemove, layers }: SelectionBarProps) {
  return (
    <>
      <div
        role="toolbar"
        aria-label={`${name} selected`}
        data-action-bar
        className="fixed inset-x-0 bottom-14 z-20 border-t border-line-subtle bg-raised px-4 py-2 md:static md:border-0 md:bg-transparent md:p-0"
      >
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2 md:mx-0 md:flex md:max-w-none md:flex-wrap">
          <Button variant="secondary" onClick={onDetails}>
            <Info {...ICON} />
            Details
          </Button>
          <Button variant="secondary" onClick={onEdit}>
            <Pencil {...ICON} />
            Edit numbers
          </Button>
          {canMoveFace ? (
            <Button variant="secondary" onClick={onMoveFace}>
              <ArrowRightLeft {...ICON} />
              Move to face…
            </Button>
          ) : null}
          {layers ? (
            <>
              <Button variant="secondary" onClick={layers.onForward ?? undefined} disabled={busy || !layers.onForward}>
                <ArrowUp {...ICON} />
                Move forward
              </Button>
              <Button variant="secondary" onClick={layers.onBack ?? undefined} disabled={busy || !layers.onBack}>
                <ArrowDown {...ICON} />
                Move back
              </Button>
            </>
          ) : null}
          <Button variant="secondary" onClick={onRemove} disabled={busy}>
            <Trash2 {...ICON} />
            Remove
          </Button>
        </div>
      </div>
      {/* Keeps the last card clear of the two-row bar (three with Move forward / back) on a phone. */}
      <div aria-hidden="true" className={`${layers ? "h-44" : "h-28"} md:hidden`} />
    </>
  );
}
