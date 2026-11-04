// A labelled field. The label is always visible (placeholders vanish when
// you type), and a hint or error is linked to the field so a screen reader
// reads it with the label.
//
// 16 px text on purpose: iOS zooms the page into any field smaller than that.

"use client";

import { Label } from "radix-ui";
import { useId } from "react";

import type { Term } from "@/lib/glossary";

import { InfoPopover } from "./info-popover";
import { FIELD_CLASSES, PasswordField } from "./password-field";

type InputProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  /** A "What's this?" beside the label, outside it so a tap never lands on the field. */
  info?: Term;
};

export function Input({
  label,
  hint,
  error,
  info,
  type = "text",
  className = "",
  autoComplete,
  ...props
}: InputProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const fieldProps = {
    ...props,
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <div className="flex items-center gap-1">
        <Label.Root htmlFor={id} className="text-sm text-ink">
          {label}
        </Label.Root>
        {info ? <InfoPopover term={info} /> : null}
      </div>
      {type === "password" ? (
        <PasswordField
          {...fieldProps}
          autoComplete={autoComplete === "new-password" ? "new-password" : "current-password"}
        />
      ) : (
        <input type={type} autoComplete={autoComplete} className={FIELD_CLASSES} {...fieldProps} />
      )}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
