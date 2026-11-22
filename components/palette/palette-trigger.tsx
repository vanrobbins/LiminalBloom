// The ways to open the command palette from the screen (spec §2): a field-like button with a
// shortcut hint in the desktop sidebar, an icon in the tablet rail, an icon in the phone's top
// bar. All three open the shell's "palette" sheet; Ctrl/Cmd+K and `/` are in use-palette-keys.

"use client";

import { Search } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useShellSheet } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";

export type PaletteTriggerVariant = "sidebar" | "rail" | "header";

const SHORTCUTS = "Control+K Meta+K";
// Gone while the map editor is embedded in the page: use-palette-keys keeps the shortcuts out of
// its way too, since a pick would leave it by client navigation (spec §13). CSS, so no state to sync.
const HIDE_WHILE_EDITING = "[body:has([data-embedded-editor])_&]:hidden";

// Nothing to subscribe to: this only tells the server render from the browser's, so the hint
// (which depends on the platform) never exists on the server and can't mismatch.
const subscribe = () => () => {};
const hintNow = () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K");

export function PaletteTrigger({ variant }: { variant: PaletteTriggerVariant }) {
  const [, setOpen] = useShellSheet("palette");
  const hint = useSyncExternalStore(subscribe, hintNow, () => "");

  if (variant !== "sidebar") {
    return (
      <Button icon variant="secondary" className={HIDE_WHILE_EDITING} aria-label="Search" aria-haspopup="dialog" aria-keyshortcuts={SHORTCUTS} onClick={() => setOpen(true)}>
        <Search aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
    );
  }
  // A navigation label may keep its word (R1); it stands in for the search bar the outline promises.
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts={SHORTCUTS}
      onClick={() => setOpen(true)}
      className={`${HIDE_WHILE_EDITING} flex min-h-11 w-full items-center gap-3 rounded border border-line bg-surface px-3 text-left text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
    >
      <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      <span className="flex-1">Search</span>
      {hint ? (
        <span aria-hidden="true" className="font-mono text-xs">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
