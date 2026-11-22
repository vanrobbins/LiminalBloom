// The command palette (0.7.0.8): one search box for the whole store, opened from the shell's
// triggers, Ctrl/Cmd+K or `/`. It lists pages and actions by what the person's role allows,
// matches planograms and zones in the browser, and asks the server for products. A pick goes to
// its page (router.push, one history entry) or acts in place (theme, store switch). Its open
// state is the shell's "palette" sheet, shared by every trigger and closed when the path changes.

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { useShell, useShellSheet } from "@/components/shell/shell-context";
import { useSwitchStore } from "@/components/shell/use-switch-store";
import { useThemeSwitch } from "@/components/shell/use-theme-switch";
import { CommandDialog } from "@/components/ui/command-dialog";
import { adjustCommands, commandsFor } from "@/lib/palette/commands";
import { paletteGroups } from "@/lib/palette/groups";
import { pushRecent, readRecent, toPick } from "@/lib/palette/recent";
import type { PaletteItem } from "@/lib/palette/types";
import { withNonce } from "@/lib/url-params";

import { PaletteList } from "./palette-list";
import { usePaletteData } from "./use-palette-data";
import { usePaletteKeys } from "./use-palette-keys";

export function CommandPalette() {
  const shell = useShell();
  const router = useRouter();
  const [open, setOpen] = useShellSheet("palette");
  const { target, switchTheme } = useThemeSwitch();
  const { switchTo } = useSwitchStore(shell?.activeStoreId ?? "");
  const [query, setQuery] = useState("");
  // Where focus was when it opened, and whether the pick went to another page.
  const opener = useRef<HTMLElement | null>(null);
  const navigated = useRef(false);

  usePaletteKeys(open, setOpen);
  // Every open starts empty (adjusting state while rendering, as React documents).
  if (!open && query !== "") setQuery("");

  const storeId = shell?.activeStoreId ?? "";
  const userId = shell?.user.id ?? "";
  const data = usePaletteData({
    open,
    query,
    storeId,
    // Signed out elsewhere: close, and let the refreshed page send the person to sign in.
    onUnauthorized: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const commands = useMemo(
    () => (shell ? commandsFor({ switches: shell.switches }, shell.stores, shell.activeStoreId, target === "dark" ? "light" : "dark") : []),
    [shell, target],
  );
  const recent = useMemo(() => (open ? readRecent(userId, storeId) : []), [open, userId, storeId]);
  const adjust = useMemo(() => (shell ? adjustCommands({ switches: shell.switches }, data.index, data.products) : []), [shell, data.index, data.products]);
  const groups = paletteGroups(query, commands, data.index, data.products, recent, adjust);

  function pick(item: PaletteItem) {
    const saved = toPick(item);
    if (saved) pushRecent(userId, storeId, saved);
    const to = "target" in item ? item.target : { href: item.href };
    setOpen(false);
    if ("theme" in to) switchTheme();
    else if ("storeId" in to) void switchTo(to.storeId);
    else {
      navigated.current = true;
      router.push(withNonce(to.href));
    }
  }

  // Radix returns focus only to a Dialog.Trigger and there is none: it is handed back here.
  function onOpenAutoFocus(event: Event) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    navigated.current = false;
    event.preventDefault();
    (event.target as HTMLElement).querySelector<HTMLElement>('[role="combobox"]')?.focus();
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault();
    // The opener belongs to the old page after a navigation, and is nothing when the shortcut
    // was pressed with nothing focused: #content (the skip link's target) is the place then.
    const back = opener.current;
    const usable = !navigated.current && back !== null && back.isConnected && back !== document.body;
    (usable ? back : document.getElementById("content"))?.focus();
  }

  if (!shell) return null;
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search the store" onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
      <PaletteList
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        products={{ state: data.state, searching: data.searching }}
        onPick={pick}
        onClose={() => setOpen(false)}
      />
    </CommandDialog>
  );
}
