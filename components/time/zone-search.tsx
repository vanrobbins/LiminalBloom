// The search box and short list inside the time zone picker (DECISIONS "Time", 11-16):
// an ARIA combobox. Arrow keys, Home and End move the active option and choose nothing; Enter
// or a click chooses. This device's zone is suggested on top, then matches with
// the United States first. Only the first CAP matches are drawn, so ~400 zones
// stay fast; typing narrows the rest.

"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { FIELD_CLASSES } from "@/components/ui/password-field";
import { deviceTimezone } from "@/lib/time/format";
import { canonicalZone, zoneChoices, zoneLabel, type ZoneChoice } from "@/lib/time/zones";

const CAP = 50;

type Group = { heading: string; items: ZoneChoice[] };

/** The device's zone, when it is one the picker lists, isn't the current one, and fits the query. */
function deviceSuggestion(current: string, query: string): ZoneChoice | null {
  const zone = canonicalZone(deviceTimezone());
  if (!zone || zone === current) return null;
  const label = zoneLabel(zone).replaceAll("_", " ");
  return label.toLowerCase().includes(query.trim().toLowerCase()) ? { zone, label: `This device: ${label}` } : null;
}

/** The matches as headed groups, trimmed to the first CAP overall. */
function capped(query: string): { groups: Group[]; total: number } {
  const { us, others } = zoneChoices(query);
  const groups: Group[] = [];
  let room = CAP;
  for (const [heading, items] of [["United States", us], ["Everywhere else", others]] as const) {
    const shown = items.slice(0, room);
    room -= shown.length;
    if (shown.length > 0) groups.push({ heading, items: shown });
  }
  return { groups, total: us.length + others.length };
}

type ZoneSearchProps = { current: string; onPick: (zone: string) => void };

export function ZoneSearch({ current, onPick }: ZoneSearchProps) {
  const base = useId();
  const [query, setQuery] = useState("");
  const device = deviceSuggestion(current, query);
  const { groups, total } = capped(query);
  const options = [...(device ? [device] : []), ...groups.flatMap((g) => g.items)];
  // Starts on the current zone when it is listed (so the list opens where you are), else the top.
  const [moved, setMoved] = useState<number | null>(null);
  const first = Math.max(0, options.findIndex((o) => o.zone === current));
  const active = Math.min(moved ?? first, options.length - 1);
  const optionId = (i: number) => `${base}-option-${i}`;
  const headingId = (heading: string) => `${base}-${heading.replaceAll(" ", "")}`;

  useEffect(() => {
    document.getElementById(`${base}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [base, active]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setMoved(Math.max(0, Math.min(options.length - 1, active + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setMoved(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Enter that confirms an IME candidate isn't a choice.
      if (event.nativeEvent.isComposing) return;
      if (options[active]) onPick(options[active].zone);
    }
  }

  const option = (item: ZoneChoice, i: number) => (
    <div
      key={`${i}-${item.zone}`}
      id={optionId(i)}
      role="option"
      aria-selected={item.zone === current}
      data-active={i === active ? "" : undefined}
      // Keeps focus in the search box through the click.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(item.zone)}
      className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded px-3 text-sm text-ink wrap-break-word hover:bg-line-subtle data-active:bg-line-subtle aria-selected:font-medium"
    >
      {item.label}
      {item.zone === current ? <Check aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" /> : null}
    </div>
  );

  // Each group's first option sits after the device suggestion and the groups before it.
  const starts = groups.map((_, g) => (device ? 1 : 0) + groups.slice(0, g).reduce((n, prev) => n + prev.items.length, 0));
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        role="combobox"
        aria-label="Find a time zone"
        aria-expanded="true"
        aria-controls={`${base}-list`}
        aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
        aria-autocomplete="list"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setMoved(null);
        }}
        onKeyDown={onKeyDown}
        placeholder="A city or region, like Denver"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={FIELD_CLASSES}
      />
      <div id={`${base}-list`} role="listbox" aria-label="Time zones" className="flex max-h-64 flex-col overflow-y-auto">
        {device ? option(device, 0) : null}
        {groups.map((group, g) => (
          <div key={group.heading} role="group" aria-labelledby={headingId(group.heading)}>
            <div id={headingId(group.heading)} role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium text-ink-muted">
              {group.heading}
            </div>
            {group.items.map((item, i) => option(item, starts[g] + i))}
          </div>
        ))}
      </div>
      {options.length === 0 ? <p className="px-1 text-sm text-ink-muted">No time zone matches &ldquo;{query.trim()}&rdquo;.</p> : null}
      {total > CAP ? <p className="px-1 text-sm text-ink-muted">Keep typing to narrow the list.</p> : null}
    </div>
  );
}
