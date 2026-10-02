// A name, committed on Enter or blur; trimmed, 1–60 characters (spec §5).
// Callers key it by item and name, so it resets when the stored name changes.

"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { MAX_NAME } from "@/lib/layout/limits";

export function NameField({ label, value, onCommit }: { label: string; value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  const trimmed = draft.trim();
  const error = trimmed.length === 0 || trimmed.length > MAX_NAME ? `Use 1 to ${MAX_NAME} characters.` : undefined;

  function commit() {
    if (!error && trimmed !== value) onCommit(trimmed);
  }

  return (
    <Input
      label={label}
      value={draft}
      error={error}
      maxLength={MAX_NAME + 20}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}
