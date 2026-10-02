// A whole number typed in and committed on Enter or blur, such as a rotation
// in degrees. Anything else is refused with a reason, never committed.

"use client";

import { useState } from "react";

import { Input } from "./input";

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onCommit: (value: number) => void;
};

export function NumberField({ label, value, min, max, suffix, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  const valid = /^\d+$/.test(text.trim()) && Number(text) >= min && Number(text) <= max;
  const error = draft !== null && !valid ? `Use a whole number from ${min} to ${max}.` : undefined;

  function commit() {
    if (draft === null || !valid) return;
    setDraft(null);
    if (Number(text) !== value) onCommit(Number(text));
  }

  return (
    <Input
      label={label}
      inputMode="numeric"
      value={text}
      hint={suffix ? `In ${suffix === "°" ? "degrees" : suffix}.` : undefined}
      error={error}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}
