// Phone only: the list of everything, and + Add (spec §10).

"use client";

import { List, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SaveStatus } from "./save-status";
import type { SaveStatus as Status } from "./use-map-editor";

export function EditorBottomBar({ status, onList, onAdd }: { status: Status; onList: () => void; onAdd: () => void }) {
  return (
    <nav aria-label="Editor" className="flex items-center justify-between gap-2 border-t border-line-subtle bg-raised px-3 py-2 md:hidden">
      <Button variant="secondary" onClick={onList}>
        <List aria-hidden="true" strokeWidth={1.75} className="size-5" />
        List
      </Button>
      <div className="sm:hidden">
        <SaveStatus status={status} />
      </div>
      <Button onClick={onAdd}>
        <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
        Add
      </Button>
    </nav>
  );
}
