// The account menu's theme item: the same rule as the corner ThemeToggle
// (lib/theme.ts), switching to the opposite of what is on screen.

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { nextTheme, type Theme } from "@/lib/theme";

// Nothing to subscribe to: this only distinguishes server from browser.
const subscribe = () => () => {};

export function useThemeSwitch(): {
  isMounted: boolean;
  target: Theme;
  switchTheme: () => void;
} {
  const { resolvedTheme, setTheme } = useTheme();

  // The server cannot know the stored choice; until the browser takes over,
  // the label would be a guess (see ThemeToggle).
  const isMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const target = nextTheme(resolvedTheme);

  return { isMounted, target, switchTheme: () => setTheme(target) };
}
