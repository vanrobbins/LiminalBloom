// The map editor's phone sheets (spec §10): the selection's properties as a
// peek panel over the map, and everything on the map as a list.

"use client";

import type { Dispatch } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { SessionAction } from "@/lib/layout/session";
import type { Issue, Layout } from "@/lib/layout/types";

import { LayoutList } from "./layout-list";

type EditorSheetsProps = {
  layout: Layout;
  selection: readonly string[];
  issues: Issue[];
  storeId: string;
  dispatch: Dispatch<SessionAction>;
  listOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  properties: React.ReactNode;
};

export function EditorSheets({ layout, selection, issues, storeId, dispatch, listOpen, onListOpenChange, properties }: EditorSheetsProps) {
  return (
    <>
      <BottomSheet
        peek
        open={selection.length > 0 && !listOpen}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "select", ids: [] });
        }}
        title="Selected"
        hideTitle
      >
        {properties}
      </BottomSheet>
      <BottomSheet open={listOpen} onOpenChange={onListOpenChange} title="Everything on the map">
        {/* Choosing an item closes the sheet, so its properties can show. */}
        <LayoutList
          layout={layout}
          selection={selection}
          issues={issues}
          storeKey={storeId}
          dispatch={(action) => {
            dispatch(action);
            if (action.type === "reveal") onListOpenChange(false);
          }}
        />
      </BottomSheet>
    </>
  );
}
