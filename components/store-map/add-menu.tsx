// Tablet and desktop: + Add opens a dropdown beside the button (DECISIONS,
// 2026-09-29: sheets on phones, dropdowns above).

"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Focus } from "@/lib/layout/hit-test";
import type { AddKind } from "@/lib/layout/session-core";

import { addOptions } from "./add-options";

export function AddMenu({ focus, onAdd }: { focus: Focus; onAdd: (kind: AddKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-5" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        {addOptions(focus).map(({ kind, label }) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd(kind)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
