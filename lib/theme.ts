// The rule behind the light/dark toggle, kept apart from React so it can be
// tested without a browser.

export type Theme = "light" | "dark";

/** The theme a tap switches to: the opposite of what is on screen. */
export function nextTheme(current: string | undefined): Theme {
  return current === "dark" ? "light" : "dark";
}
