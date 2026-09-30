// The one button. Four variants, all at least 44 px tall (§5.4). Gold is
// the primary action only (§5.5).
//
// `asChild` hands the styling to its child through Radix Slot, so a link can
// look like a button and still be a real link: it opens in a new tab, shows
// its address, and is announced as a link.

import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60";

// Classes are added, never merged, so a caller cannot undo px-4 with px-0;
// the shape is chosen here instead.
const LABELLED = "px-4";
const ICON_ONLY = "size-11 shrink-0";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand font-medium text-on-brand",
  secondary: "border border-line bg-raised text-ink",
  ghost: "text-brand-strong underline underline-offset-4",
  danger: "bg-danger font-medium text-raised",
};

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Replaces the label while loading, naming the work: "Signing in…". */
  loadingText?: string;
  asChild?: boolean;
  /** A 44 px square holding only an icon. Give it an accessible name. */
  icon?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  loadingText,
  asChild = false,
  icon = false,
  className = "",
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const shape = icon ? ICON_ONLY : LABELLED;
  const classes = `${BASE} ${shape} ${VARIANT_CLASSES[variant]} ${className}`.trim();

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
