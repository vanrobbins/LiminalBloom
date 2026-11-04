// A name tooltip (Week 6.5 spec §5.1): shows a control's name on hover and on
// keyboard focus, never on touch (Radix's default). Icon-only buttons get one
// automatically from their aria-label (see Button), so the two never drift.

"use client";

import { Tooltip as Primitive } from "radix-ui";

type TooltipProps = { label: string; children: React.ReactElement; side?: "top" | "right" | "bottom" | "left" };

/**
 * Each tooltip carries its own provider (400 ms before it shows), so a Button
 * works anywhere (tests, portals, dialogs) with no provider above it. The cost:
 * moving between two buttons waits the 400 ms again (DECISIONS 11-04).
 */
export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  return (
    <Primitive.Provider delayDuration={400} skipDelayDuration={300}>
      <Primitive.Root>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            data-tooltip
            className="z-50 max-w-64 rounded border border-line bg-ink px-2 py-1 text-sm text-surface shadow-lg"
          >
            {label}
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}

/** A tooltip only when there is a name to show: for controls that are icon-only in one form and labelled in another. */
export function NameTip({ label, children }: { label: string | null; children: React.ReactElement }) {
  return label ? <Tooltip label={label}>{children}</Tooltip> : children;
}
