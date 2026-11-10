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

import { X } from "lucide-react";
import { VisuallyHidden } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";

import { Button } from "./button";
import { PeekPanel } from "./peek-panel";

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
  /** 75 dvh tall instead of fitting its content (the map's fixture panel). */
  tall?: boolean;
  /** On closing: `event.preventDefault()` to put focus somewhere else than the opener. */
  onCloseAutoFocus?: (event: Event) => void;
  children: React.ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  peek = false,
  tall = false,
  onCloseAutoFocus,
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

  // A toast is the top layer, so it would take Escape and leave the sheet open.
  // Popovers and menus inside the sheet still close first.
  useEffect(() => {
    if (!open || peek) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !document.querySelector("[data-toast-viewport] li")) return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      event.stopPropagation();
      changeOpen(false);
    }
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  });

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
          // A tap on a toast (Undo, Dismiss) is outside the sheet but must not close it.
          onInteractOutside={(event) => {
            if (event.target instanceof Element && event.target.closest("[data-toast-viewport]")) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            // Runs before focus moves in, so this is still the opener.
            returnFocusTo.current = document.activeElement as HTMLElement | null;
            // The sheet itself, not its × (whose tooltip would open and take the first Escape).
            event.preventDefault();
            (event.target as HTMLElement).focus();
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border border-line-subtle bg-raised shadow-2xl outline-none ${tall ? "h-[75dvh]" : "max-h-[85vh]"}`}
        >
          <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" />
          <div className="flex items-center justify-between gap-4 px-6 pt-4">
            {hideTitle ? <VisuallyHidden.Root>{heading}</VisuallyHidden.Root> : heading}
            <Drawer.Close asChild>
              <Button variant="ghost" icon aria-label="Close" className="-mr-2 ml-auto">
                <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
              </Button>
            </Drawer.Close>
          </div>
          <div className={`overflow-y-auto px-6 pt-4 pb-8 ${tall ? "min-h-0 flex-1" : ""}`}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
