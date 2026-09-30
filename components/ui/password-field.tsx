// The password half of Input: a field plus a show/hide toggle, so a
// password can be checked before submitting on a phone keyboard.
//
// Radix PasswordToggleField is a preview API (`unstable_`). It is used only
// here, so if it changes, this is the one file to update.

"use client";

import { Eye, EyeOff } from "lucide-react";
import { unstable_PasswordToggleField as PasswordToggleField } from "radix-ui";
import { useState } from "react";

export const FIELD_CLASSES =
  "min-h-11 w-full rounded border border-line bg-raised px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-invalid:border-danger";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type" | "autoComplete"> & {
  id: string;
  autoComplete?: "current-password" | "new-password";
};

export function PasswordField({ id, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    // The id goes on Root too: the toggle's aria-controls is built from it.
    <PasswordToggleField.Root id={id} visible={isVisible} onVisibilityChange={setIsVisible}>
      <div className="relative">
        <PasswordToggleField.Input
          {...props}
          id={id}
          className={`${FIELD_CLASSES} pr-12`}
        />
        <PasswordToggleField.Toggle
          aria-label={isVisible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted"
        >
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </PasswordToggleField.Toggle>
      </div>
    </PasswordToggleField.Root>
  );
}
