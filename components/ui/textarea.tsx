// A labelled multi-line field, the Input's sibling: the label is always visible and a hint or error is linked
// to the field. 16 px text on purpose (iOS zooms into anything smaller). Plain text only: what is typed is
// stored and shown as text, never as HTML or Markdown.

"use client";

import { Label } from "radix-ui";
import { useId } from "react";

type TextareaProps = Omit<React.ComponentProps<"textarea">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Textarea({ label, hint, error, className = "", rows = 5, ...props }: TextareaProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <Label.Root htmlFor={id} className="text-sm text-ink">
        {label}
      </Label.Root>
      <textarea
        rows={rows}
        {...props}
        id={id}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={[hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined}
        className="min-h-11 w-full resize-y rounded border border-line bg-raised px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-invalid:border-danger"
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
