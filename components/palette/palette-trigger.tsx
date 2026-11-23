// The way to open the command palette from the screen (spec §2): a search icon beside the store
// menu on desktop, under it in the tablet rail, and in the phone's top bar (11-22, Van).
// It opens the shell's "palette" sheet; Ctrl/Cmd+K and `/` are in use-palette-keys.

"use client";

import { Search } from "lucide-react";

import { useShellSheet } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";

const SHORTCUTS = "Control+K Meta+K";
// Gone while the map editor is embedded in the page: use-palette-keys keeps the shortcuts out of
// its way too, since a pick would leave it by client navigation (spec §13). CSS, so no state to sync.
const HIDE_WHILE_EDITING = "[body:has([data-embedded-editor])_&]:hidden";

export function PaletteTrigger() {
  const [, setOpen] = useShellSheet("palette");

  return (
    <Button icon variant="secondary" className={HIDE_WHILE_EDITING} aria-label="Search" aria-haspopup="dialog" aria-keyshortcuts={SHORTCUTS} onClick={() => setOpen(true)}>
      <Search aria-hidden="true" strokeWidth={1.75} className="size-5" />
    </Button>
  );
}
