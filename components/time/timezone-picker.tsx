// Choose a store's time zone (DECISIONS "Time", 10-12): type to narrow ~400
// zones, US zones first. A native select underneath, so phones use their own
// picker. The chosen zone stays listed while the filter hides the rest, so
// the select never quietly changes value under a filter.

"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { zoneChoices, zoneLabel } from "@/lib/time/zones";

type TimezonePickerProps = { name: string; defaultZone: string; label?: string };

export function TimezonePicker({ name, defaultZone, label = "Time zone" }: TimezonePickerProps) {
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState(defaultZone);
  const { us, others } = zoneChoices(query);
  const listed = us.some((z) => z.zone === zone) || others.some((z) => z.zone === zone);

  return (
    <div className="flex flex-col gap-2">
      <Input label="Find a time zone" type="search" value={query} onChange={(e) => setQuery(e.target.value)} hint="A city or region, like Denver or London." autoComplete="off" />
      <label className="flex flex-col gap-1 text-sm text-ink">
        {label}
        <select name={name} value={zone} onChange={(e) => setZone(e.target.value)} className={FIELD_CLASSES}>
          {listed ? null : <option value={zone}>{zoneLabel(zone)}</option>}
          {us.length > 0 ? (
            <optgroup label="United States">
              {us.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {others.length > 0 ? (
            <optgroup label="Everywhere else">
              {others.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
    </div>
  );
}
