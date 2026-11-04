// "What's this?" (Week 6.5 spec §5.2): a 44 px ⓘ beside a term's first
// appearance on a screen, opening the glossary text. A popover, not a tooltip,
// so it works on touch: tap or click opens it, Escape or a tap outside closes it.

"use client";

import { Info } from "lucide-react";
import { Popover } from "radix-ui";

import { GLOSSARY, type Term } from "@/lib/glossary";

export function InfoPopover({ term }: { term: Term }) {
  const entry = GLOSSARY[term];
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label={`What's ${entry.term.toLowerCase()}?`}
        data-info={term}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Info aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-72 max-w-[calc(100vw-16px)] rounded-lg border border-line bg-raised p-3 text-sm text-ink shadow-lg"
        >
          <p className="font-medium">{entry.term}</p>
          <p className="mt-1 text-ink-muted">{entry.text}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
