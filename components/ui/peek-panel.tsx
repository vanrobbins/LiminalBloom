// A bottom sheet's peek mode (the map editor's properties, spec §10): a plain
// panel, not a dialog, so the map stays usable. It rests low; the handle (tap
// or drag) raises it to full. BottomSheet with `peek` renders this.

"use client";

import { X } from "lucide-react";
import { useRef } from "react";

import { Button } from "./button";
import { Tooltip } from "./tooltip";

const PEEK_HEIGHT = "40dvh";
const FULL_HEIGHT = "85dvh";
// Vertical travel that counts as a swipe rather than a tap.
const SWIPE_PX = 40;

type PeekPanelProps = {
  title: string;
  heading: React.ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  children: React.ReactNode;
};

export function PeekPanel({ title, heading, expanded, onExpandedChange, onClose, children }: PeekPanelProps) {
  const startY = useRef<number | null>(null);
  // A swipe also ends in a click; that click must not undo it.
  const swiped = useRef(false);

  return (
    <section
      data-peek-panel=""
      aria-label={title}
      // Escape only counts while focus is inside, so it never steals the map's own Escape.
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      style={{ height: expanded ? FULL_HEIGHT : PEEK_HEIGHT }}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border border-line-subtle bg-raised shadow-2xl"
    >
      <Tooltip label={expanded ? "Collapse" : "Expand"}>
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          onPointerDown={(event) => {
            startY.current = event.clientY;
            swiped.current = false;
          }}
          onPointerUp={(event) => {
            if (startY.current === null) return;
            const travel = event.clientY - startY.current;
            startY.current = null;
            if (travel <= -SWIPE_PX) onExpandedChange(true);
            else if (travel >= SWIPE_PX) onExpandedChange(false);
            else return;
            swiped.current = true;
          }}
          onClick={() => {
            if (!swiped.current) onExpandedChange(!expanded);
            swiped.current = false;
          }}
          className="flex min-h-11 w-full touch-none items-center justify-center"
        >
          <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-line" />
        </button>
      </Tooltip>
      <div className="flex items-center justify-between gap-4 px-6">
        {heading}
        <Button variant="ghost" icon aria-label="Close" className="-mr-2 ml-auto" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-8">{children}</div>
    </section>
  );
}
