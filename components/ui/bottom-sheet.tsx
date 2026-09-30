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
import { useRef } from "react";
import { Drawer } from "vaul";

import { Button } from "./button";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Always required: it is how a screen reader names the sheet. */
  title: string;
  hideTitle?: boolean;
  children: React.ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  children,
}: BottomSheetProps) {
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const heading = (
    <Drawer.Title className="text-xl font-semibold tracking-tight text-ink">
      {title}
    </Drawer.Title>
  );

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} autoFocus>
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
