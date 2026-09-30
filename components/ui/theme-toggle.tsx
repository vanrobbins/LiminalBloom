// Flips between light and dark, starting from whatever is on screen -- on a
// first visit, the device's own setting. The choice is remembered from then on.

"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { AccessibleIcon } from "radix-ui";
import { useSyncExternalStore } from "react";

import { nextTheme } from "@/lib/theme";

import { Button } from "./button";

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
    return <span aria-hidden="true" className="block size-11" />;
  }

  const target = nextTheme(resolvedTheme);
  const Icon = target === "dark" ? Moon : Sun;

  return (
    <Button variant="secondary" icon onClick={() => setTheme(target)}>
      <AccessibleIcon.Root label={`Switch to ${target}`}>
        <Icon strokeWidth={1.75} className="size-5" />
      </AccessibleIcon.Root>
    </Button>
  );
}
