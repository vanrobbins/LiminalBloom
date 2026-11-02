// What's selected on Planogram Detail and what the product panel shows (Part 2
// spec §4): in a draft a tap selects, and Details or Edit numbers opens the
// panel; on the published version a tap also opens it. On tablet and desktop
// the panel isn't modal, so it follows the selection; deselecting closes it.

"use client";

import { useState } from "react";

import type { GridItem } from "./grid-items";
import type { SheetMode } from "./planogram-body";

export function useSelection(isEditing: boolean, items: readonly GridItem[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("details");

  // A read-only sheet whose product is no longer shown closes, rather than
  // standing open and empty. (While editing, the editor says "Removed on
  // another device" instead.) Adjusted during render, as React allows for own state.
  if (sheetId !== null && !isEditing && !items.some((i) => i.id === sheetId)) setSheetId(null);

  function openSheet(id: string | null, mode: SheetMode = "details") {
    setSheetMode(mode);
    setSheetId(id);
  }

  function select(id: string | null) {
    setSelectedId(id);
    if (id === null) setSheetId(null);
    else if (isEditing && sheetId !== null && sheetId !== id) setSheetId(id);
  }

  // In a draft a tap selects; on the published version it also opens the sheet (as before Part 2).
  function onTile(id: string) {
    select(id);
    if (!isEditing) openSheet(id, "details");
  }

  // The form opens beside the grid, past every card on a keyboard: focus its first field.
  function editNumbers(id: string) {
    openSheet(id, "edit");
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-placement-editor] :is(input, select)")?.focus());
  }

  return { selectedId, setSelectedId, sheetId, sheetMode, openSheet, select, onTile, editNumbers };
}
