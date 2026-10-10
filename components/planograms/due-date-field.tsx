// The due date (spec §3.3 item 5): stored and shown this week; tasks use it later.
// Saved on blur or Enter, not on every change: a date field reports a valid
// "0002-10-15" after the first digit of the year.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { setDueDateAction } from "@/app/(app)/planograms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EARLIEST_DUE_DATE } from "@/lib/planograms/types";
import { toast } from "@/lib/toast";

type DueDateFieldProps = { fixtureId: string; dueDate: string | null };

export function DueDateField({ fixtureId, dueDate }: DueDateFieldProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const saved = useRef(dueDate ?? "");

  async function save(next: string | null) {
    setBusy(true);
    try {
      const reply = await setDueDateAction(fixtureId, next);
      if (reply.status === "saved") saved.current = next ?? "";
      toast({ tone: reply.status === "saved" ? "success" : "error", title: reply.message });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Couldn't save the due date", description: "Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  /** An empty field (or a half-typed one) is left alone; Clear clears. */
  function commit(value: string) {
    if (!value || value === saved.current) return setError(undefined);
    if (value < EARLIEST_DUE_DATE) return setError("Choose a date from 2000 on.");
    setError(undefined);
    void save(value);
  }

  return (
    <div className="flex items-end gap-2">
      <Input
        label="Due date"
        type="date"
        min={EARLIEST_DUE_DATE}
        defaultValue={dueDate ?? ""}
        disabled={busy}
        error={error}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? commit(e.currentTarget.value) : undefined)}
      />
      {dueDate ? (
        <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
