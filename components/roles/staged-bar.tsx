// The bar that sticks to the bottom while permissions are staged (spec 0.7, 4.8 part 3):
// how many roles changed (announced politely), Discard, and Review and save. When the staged
// state would not nest it says which role blocks it, and Review and save stays off.

"use client";

import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type StagedBarProps = {
  count: number;
  /** Why the staged state can't be saved yet, or null. */
  problem: string | null;
  /** Opens the confirm; the opener gets focus back on Cancel. */
  onDiscard: (opener: HTMLElement) => void;
  onReview: (opener: HTMLElement) => void;
};

export function StagedBar({ count, problem, onDiscard, onReview }: StagedBarProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-raised px-4 py-3 md:mx-0 md:rounded-lg md:border">
      <p className="text-ink">
        {count === 0 ? "" : count === 1 ? "1 role changed" : `${count} roles changed`}
      </p>
      <p className="text-sm text-ink-muted">To rename, move, add or delete a role, save or discard your changes first.</p>
      {problem ? (
        <p role="status" className="mt-1 text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button icon variant="secondary" onClick={(event) => onDiscard(event.currentTarget)} aria-label="Discard changes">
          <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
        <Button icon disabled={problem !== null} onClick={(event) => onReview(event.currentTarget)} aria-label="Review and save">
          <Save aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
    </div>
  );
}
