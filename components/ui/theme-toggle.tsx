// Flips between light and dark, starting from whatever is on screen -- on a
// first visit, the device's own setting. The choice is remembered from then on.

"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { nextTheme } from "@/lib/theme";

// Nothing to subscribe to: this only distinguishes server from browser.
const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // The server cannot know the stored choice, so until the browser takes over
  // render a same-size placeholder. Rendering the button early would show the
  // wrong label and trigger a hydration mismatch (see the next-themes docs).
  const isMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!isMounted) {
    return <span aria-hidden="true" className="block h-11 w-36" />;
  }

  const target = nextTheme(resolvedTheme);

  return (
    <button
      type="button"
      onClick={() => setTheme(target)}
      className="h-11 w-36 rounded border border-line bg-raised text-sm text-ink"
    >
      Switch to {target}
    </button>
  );
}
