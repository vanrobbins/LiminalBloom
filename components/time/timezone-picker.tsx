// Choose a store's time zone (DECISIONS "Time", 10-12; one field since 11-16): a
// button showing the current zone opens a search box and a short list (ZoneSearch).
// A popover on wide screens, a bottom sheet on phones. Moving through the list
// never changes the zone; choosing does, once, through `onChange` (a form that
// saves on a pick) and into a hidden input named `name` (a form that submits it).
// Closing, by choosing or Escape, puts focus back on the button.

"use client";

import { ChevronsUpDown } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useRef, useState } from "react";

import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { zoneLabel } from "@/lib/time/zones";

import { ZoneSearch } from "./zone-search";

type TimezonePickerProps = {
  name: string;
  defaultZone: string;
  label?: string;
  /** Makes the zone the caller's to hold (a form that can put it back); without it the picker keeps its own. */
  value?: string;
  /** Called once with the zone a pick chose; not for moving through the list, and not for picking the zone already set. */
  onChange?: (zone: string) => void;
};

export function TimezonePicker({ name, defaultZone, label = "Time zone", value, onChange }: TimezonePickerProps) {
  const [own, setOwn] = useState(defaultZone);
  const zone = value ?? own;
  const [open, setOpen] = useState(false);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  function pick(next: string) {
    setOpen(false);
    trigger.current?.focus();
    if (next === zone) return;
    setOwn(next);
    onChange?.(next);
  }

  const button = (
    <button
      ref={trigger}
      id={`${id}-button`}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-labelledby={`${id}-label ${id}-button`}
      onClick={isPhone ? () => setOpen(true) : undefined}
      className={`${FIELD_CLASSES} flex items-center justify-between gap-2 text-left`}
    >
      <span className="min-w-0 wrap-break-word">{zoneLabel(zone).replaceAll("_", " ")}</span>
      <ChevronsUpDown aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-muted" />
    </button>
  );

  return (
    <div className="flex flex-col gap-1">
      <label id={`${id}-label`} htmlFor={`${id}-button`} className="text-sm text-ink">
        {label}
      </label>
      <input type="hidden" name={name} value={zone} />
      {isPhone ? (
        <>
          {button}
          <BottomSheet open={open} onOpenChange={setOpen} title="Choose a time zone" focusOnOpen="[role=combobox]">
            <ZoneSearch current={zone} onPick={pick} />
          </BottomSheet>
        </>
      ) : (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>{button}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              aria-label="Choose a time zone"
              align="start"
              sideOffset={4}
              collisionPadding={8}
              className="z-50 w-(--radix-popover-trigger-width) min-w-72 max-w-[calc(100vw-16px)] rounded-lg border border-line bg-raised p-2 shadow-lg"
            >
              <ZoneSearch current={zone} onPick={pick} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
