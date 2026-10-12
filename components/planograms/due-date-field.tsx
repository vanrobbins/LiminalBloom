// The due date's form (spec §4.6): saved by its Save button only. Saving on
// blur or Enter double-saved and could swallow a Clear (Week 5 polish).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setDueDateAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EARLIEST_DUE_DATE } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

type DueDateFormProps = { fixtureId: string; dueDate: string | null; onDone: () => void };

export function DueDateForm({ fixtureId, dueDate, onDone }: DueDateFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(dueDate ?? "");
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  async function send(next: string | null, kind: "save" | "clear") {
    setBusy(kind);
    try {
      const reply = await setDueDateAction(fixtureId, next);
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      if (reply.status === "saved") onDone();
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't save the due date", description: "Check the connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      // Our own messages, not the browser's bubble for `min`.
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return setError("Choose a date, or Clear.");
        if (value < EARLIEST_DUE_DATE) return setError("Choose a date from 2000 on.");
        setError(undefined);
        void send(value, "save");
      }}
    >
      <Input label="Due date" type="date" min={EARLIEST_DUE_DATE} value={value} onChange={(e) => setValue(e.target.value)} error={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={busy === "save"} loadingText="Saving…" disabled={busy !== null}>
          Save
        </Button>
        {dueDate ? (
          <Button variant="secondary" onClick={() => send(null, "clear")} loading={busy === "clear"} loadingText="Clearing…" disabled={busy !== null}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
