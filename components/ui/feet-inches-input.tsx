// A length as people say it, feet and inches, stored as whole inches
// (spec §4). It commits only a whole number in range, so a cleared field or
// a typo can never reach the layout (Review Focus 2).

"use client";

import { useId, useState } from "react";

import { formatLength } from "@/lib/layout/format";

import { FIELD_CLASSES } from "./password-field";

type FeetInchesInputProps = {
  label: string;
  /** Inches. */
  value: number;
  min: number;
  max: number;
  onCommit: (inches: number) => void;
  /** Names the two inputs `<name>-feet` and `<name>-inches`, so a form can read the draft with `readFeetInches`. */
  name?: string;
};

type Draft = { feet: string; inches: string };

function split(value: number): Draft {
  return { feet: String(Math.floor(value / 12)), inches: String(value % 12) };
}

/** Whole, non-negative numbers only; an empty field counts as 0. */
function parse({ feet, inches }: Draft): number | null {
  const toWhole = (text: string) => (text.trim() === "" ? 0 : /^\d+$/.test(text.trim()) ? Number(text) : NaN);
  const f = toWhole(feet);
  const i = toWhole(inches);
  return Number.isNaN(f) || Number.isNaN(i) ? null : f * 12 + i;
}

/** What a named FeetInchesInput holds right now, typed or not yet committed: inches, or null when it is not a whole number. */
export function readFeetInches(data: FormData, name: string): number | null {
  const text = (part: keyof Draft) => {
    const value = data.get(`${name}-${part}`);
    return typeof value === "string" ? value : "";
  };
  return parse({ feet: text("feet"), inches: text("inches") });
}

export function FeetInchesInput({ label, value, min, max, onCommit, name }: FeetInchesInputProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const shown = draft ?? split(value);
  const parsed = parse(shown);

  let error: string | undefined;
  if (draft !== null) {
    if (parsed === null) error = "Use whole numbers.";
    else if (parsed < min || parsed > max) error = `Between ${formatLength(min)} and ${formatLength(max)}.`;
  }

  function commit() {
    if (draft === null || error !== undefined || parsed === null) return;
    setDraft(null);
    if (parsed !== value) onCommit(parsed);
  }

  const field = (part: keyof Draft, unit: string) => (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        aria-label={`${label}, ${unit === "ft" ? "feet" : "inches"}`}
        name={name ? `${name}-${part}` : undefined}
        inputMode="numeric"
        value={shown[part]}
        onChange={(event) => setDraft({ ...shown, [part]: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD_CLASSES} w-20`}
      />
      <span aria-hidden="true">{unit}</span>
    </label>
  );

  return (
    <fieldset
      className="flex flex-col gap-1"
      onBlur={(event) => {
        // Tabbing from feet to inches is still one edit: commit once focus
        // leaves both fields, so one edit is one undo step.
        if (!event.currentTarget.contains(event.relatedTarget)) commit();
      }}
    >
      <legend className="mb-1 text-sm text-ink">{label}</legend>
      <div className="flex gap-3">
        {field("feet", "ft")}
        {field("inches", "in")}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
