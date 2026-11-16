// The due date's form (spec §4.6): saves the moment a date is picked or Clear is pressed,
// with no Save button (R3, 0.7.0.5). The chip behind it shows the result, so the form
// closes on success; a refusal stays here, under the field. A half-typed year is not a
// date yet, so nothing is sent until the field holds one, and it says so on leaving.

"use client";

import { useState } from "react";

import { setDueDateAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInlineSave } from "@/components/ui/use-inline-save";
import { EARLIEST_DUE_DATE } from "@/lib/planograms/types";

import { PanelSaveLine } from "./panel-save-line";

type DueDateFormProps = { fixtureId: string; dueDate: string | null; onDone: () => void };

export function DueDateForm({ fixtureId, dueDate, onDone }: DueDateFormProps) {
  const { status, save, busy } = useInlineSave("Couldn't save the due date");
  const [value, setValue] = useState(dueDate ?? "");
  const [error, setError] = useState<string | undefined>(undefined);

  async function send(next: string | null) {
    setError(undefined);
    const reply = await save(() => setDueDateAction(fixtureId, next));
    if (reply?.status === "saved") onDone();
    else if (reply) setError(reply.message);
  }

  return (
    <form
      // Our own messages, not the browser's bubble for `min`.
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <Input
        label="Due date"
        info="dueDate"
        type="date"
        min={EARLIEST_DUE_DATE}
        value={value}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          setError(undefined);
          if (next >= EARLIEST_DUE_DATE && next !== dueDate) void send(next);
        }}
        onBlur={() => {
          if (!value) setError(dueDate ? "Choose a date, or Clear." : undefined);
          else if (value < EARLIEST_DUE_DATE) setError("Choose a date from 2000 on.");
        }}
        error={error}
      />
      <div className="flex items-center gap-3">
        {dueDate ? (
          <Button variant="secondary" onClick={() => send(null)} disabled={busy}>
            Clear
          </Button>
        ) : null}
        <PanelSaveLine status={status} />
      </div>
    </form>
  );
}
