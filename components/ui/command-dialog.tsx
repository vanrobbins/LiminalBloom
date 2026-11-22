// The window the command palette lives in (0.7.0.8 spec §5): one Radix Dialog at every size, and
// CSS picks the form. A full-screen panel on a phone, where the keyboard would cover a bottom
// sheet's results; a dialog near the top from 768 px. Radix brings the focus trap and Escape.
// Radix returns focus only to a Dialog.Trigger, and the palette has none, so where focus goes
// on close is the caller's: `onOpenAutoFocus` and `onCloseAutoFocus` hand it over.

"use client";

import { Dialog as Primitive, VisuallyHidden } from "radix-ui";

type CommandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the dialog for a screen reader; not drawn. */
  title: string;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  children: React.ReactNode;
};

export function CommandDialog({ open, onOpenChange, title, onOpenAutoFocus, onCloseAutoFocus, children }: CommandDialogProps) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-scrim motion-safe:data-[state=open]:animate-fade-in" />
        <Primitive.Content
          // use-palette-keys leaves this one out of "another modal is open".
          data-palette=""
          aria-modal="true"
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-0 z-50 flex flex-col bg-raised outline-none motion-safe:data-[state=closed]:animate-palette-out motion-safe:data-[state=open]:animate-palette-in md:inset-auto md:top-[12dvh] md:left-1/2 md:max-h-[70dvh] md:w-[calc(100vw-32px)] md:max-w-xl md:-translate-x-1/2 md:rounded-lg md:border md:border-line md:shadow-2xl"
        >
          <VisuallyHidden.Root asChild>
            <Primitive.Title>{title}</Primitive.Title>
          </VisuallyHidden.Root>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
