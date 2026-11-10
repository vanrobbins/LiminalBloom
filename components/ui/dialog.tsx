// A window over the page for a decision or a short form: first-time outline
// setup and delete confirmations. Radix brings the focus trap, Escape to
// close, and focus back to where it was. A title is required: it is how a
// screen reader names the dialog.

"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";

import { Button } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Call `event.preventDefault()` to send focus somewhere other than back to the opener. */
  onCloseAutoFocus?: (event: Event) => void;
};

export function Dialog({ open, onOpenChange, title, description, children, onCloseAutoFocus }: DialogProps) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Primitive.Content
          onCloseAutoFocus={onCloseAutoFocus}
          // The dialog itself, not its × (whose tooltip would open and take the first Escape).
          // A field with autoFocus inside still wins: Radix skips this when focus is already in.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.target as HTMLElement).focus();
          }}
          // Without a description, say so, or Radix warns about a missing one.
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-line-subtle bg-raised p-6 shadow-2xl outline-none"
        >
          <div className="flex items-start justify-between gap-4">
            <Primitive.Title className="text-xl font-semibold tracking-tight text-ink">{title}</Primitive.Title>
            <Primitive.Close asChild>
              <Button variant="ghost" icon aria-label="Close" className="-mt-2 -mr-2">
                <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
              </Button>
            </Primitive.Close>
          </div>
          {description ? (
            <Primitive.Description className="text-sm text-ink-muted">{description}</Primitive.Description>
          ) : null}
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
