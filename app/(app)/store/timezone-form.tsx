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
  // The picker follows the stored zone: put back after a refusal, and again when the reload brings the server's current one.
  const [chosen, setChosen] = useState(zone);
  const [known, setKnown] = useState(zone);
  if (known !== zone) {
    setKnown(zone);
    setChosen(zone);
  }

  async function choose(next: string) {
    // The next save needs the version the reload brings, so a pick made while one is out is not sent (and the picker keeps its focus).
    if (busy) return;
    setChosen(next);
    setProblem(undefined);
    const reply = await save(() => saveTimezoneAction(next, version));
    if (reply && reply.status !== "saved") {
      setProblem(reply.message);
      setChosen(zone);
    }
  }

  return (
    // The change event rises from the picker's select (the find box is a search input and saves nothing).
    <form
      aria-busy={busy || undefined}
      className="flex flex-col gap-1"
      onSubmit={(event) => event.preventDefault()}
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) void choose(event.target.value);
      }}
    >
      <TimezonePicker name="timezone" defaultZone={zone} value={chosen} />
      {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      <PanelSaveLine status={status} />
    </form>
  );
}
