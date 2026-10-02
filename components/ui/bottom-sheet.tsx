// A panel that slides up from the bottom (§5.2: phones open panels as bottom
// sheets). Vaul adds drag-to-close on top of Radix Dialog, which brings the
// focus trap and Escape to close.
//
// Focus is handled here, not left to the defaults: Vaul keeps focus outside
// the sheet unless `autoFocus` is set, and Radix only returns focus to a
// Drawer.Trigger, which a controlled sheet does not have. So the sheet
// remembers what had focus when it opened and hands focus back on close.
//
// Always controlled: the caller owns `open`. Piece 3 decides whether larger
// screens get a side panel instead.

"use client";

import { VisuallyHidden } from "radix-ui";
import { useRef, useState } from "react";
import { Drawer } from "vaul";

import { Button } from "./button";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Always required: it is how a screen reader names the sheet. */
  title: string;
  hideTitle?: boolean;
  /**
   * Peek mode (the map editor's properties, spec §10): a plain panel, not a
   * dialog, so the map stays usable: no scrim, focus trap, aria-hiding or body
   * pointer lock. It rests low; the handle (tap or drag) raises it to full.
   */
  peek?: boolean;
  children: React.ReactNode;
};

const PEEK_HEIGHT = "40dvh";
const FULL_HEIGHT = "85dvh";
// Vertical travel that counts as a swipe rather than a tap.
const SWIPE_PX = 40;

export function BottomSheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  peek = false,
  children,
}: BottomSheetProps) {
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  // A sheet raised to full reopens at the peek height: adjust during render
  // when `open` flips, which the compiler allows (an effect would not be).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setExpanded(false);
  }

  // Fields commit on blur, and an iOS tap on Close may not blur them: commit before the sheet goes.
  function changeOpen(next: boolean) {
    if (!next && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onOpenChange(next);
  }

  const heading = (
    <Drawer.Title className="text-xl font-semibold tracking-tight text-ink">
      {title}
    </Drawer.Title>
  );

  if (peek) {
    if (!open) return null;
    // Drawer.Title only works inside a dialog, which a peek panel is not.
    const peekHeading = <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>;
    return (
      <PeekPanel
        title={title}
        heading={hideTitle ? <VisuallyHidden.Root>{peekHeading}</VisuallyHidden.Root> : peekHeading}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onClose={() => changeOpen(false)}
      >
        {children}
      </PeekPanel>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={changeOpen} autoFocus>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Drawer.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            // Runs before focus moves in, so this is still the opener.
            returnFocusTo.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-line-subtle bg-raised shadow-2xl outline-none"
        >
          <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" />
          <div className="flex items-center justify-between gap-4 px-6 pt-4">
            {hideTitle ? <VisuallyHidden.Root>{heading}</VisuallyHidden.Root> : heading}
            <Drawer.Close asChild>
              <Button variant="ghost" className="ml-auto">
                Close
              </Button>
            </Drawer.Close>
          </div>
          <div className="overflow-y-auto px-6 pt-4 pb-8">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

type PeekPanelProps = {
  title: string;
  heading: React.ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  children: React.ReactNode;
};

function PeekPanel({ title, heading, expanded, onExpandedChange, onClose, children }: PeekPanelProps) {
  const startY = useRef<number | null>(null);
  // A swipe also ends in a click; that click must not undo it.
  const swiped = useRef(false);

  return (
    <section
      aria-label={title}
      // Escape only counts while focus is inside, so it never steals the map's own Escape.
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      style={{ height: expanded ? FULL_HEIGHT : PEEK_HEIGHT }}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border border-line-subtle bg-raised shadow-2xl"
    >
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
      <div className="flex items-center justify-between gap-4 px-6">
        {heading}
        <Button variant="ghost" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-8">{children}</div>
    </section>
  );
}
