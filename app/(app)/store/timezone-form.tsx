// The time zone's form on Store settings: the picker saves the moment a zone is chosen,
// with the save indicator beside it and no Save button (R3, 0.7.0.5). The page reloads
// after a save so every "today" on it follows the new zone.

"use client";

import { useState } from "react";

import { PanelSaveLine } from "@/components/planograms/panel-save-line";
import { TimezonePicker } from "@/components/time/timezone-picker";
import { useInlineSave } from "@/components/ui/use-inline-save";

import { saveTimezoneAction } from "./actions";

export function TimezoneForm({ zone, version }: { zone: string; version: number }) {
  const { status, save, busy } = useInlineSave();
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // Bumped by a refusal, so the picker shows the stored zone again instead of the one refused.
  const [resets, setResets] = useState(0);

  async function choose(next: string) {
    setProblem(undefined);
    const reply = await save(() => saveTimezoneAction(next, version));
    if (reply && reply.status !== "saved") {
      setProblem(reply.message);
      setResets((n) => n + 1);
    }
  }

  return (
    // The change event rises from the picker's select (the find box is a search input and saves nothing).
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => event.preventDefault()}
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) void choose(event.target.value);
      }}
    >
      {/* A fieldset, so the zone can't change under a save: the next one needs the version the reload brings. */}
      <fieldset disabled={busy} className="contents">
        <TimezonePicker key={resets} name="timezone" defaultZone={zone} />
      </fieldset>
      {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      <PanelSaveLine status={status} />
    </form>
  );
}
