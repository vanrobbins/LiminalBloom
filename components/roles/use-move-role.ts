// Moving a role up or down from its menu (0.7.0.5 spec §3.1): no toast. A move that
// lands just moves the row (the reloaded list is the feedback, and there is no
// animation, since a keyboard-driven move is high-frequency); what a refusal says
// shows under the role's own row. Both are also said in a polite live region.
// A lost connection stays a toast.

"use client";

import { useState } from "react";

import { moveRoleAction } from "@/app/(app)/roles/actions";
import { nestingText } from "@/lib/access/nesting";
import type { RoleRow } from "@/lib/access/roles-view";
import { toast } from "@/lib/toast";

import { NETWORK_TEXT, refusalText } from "./refusal-text";

/** What the last move said: `id` is the role whose row shows it when `refused`. */
export type MoveSaid = { id: string; text: string; refused: boolean } | null;

export function useMoveRole({ refresh, focusAfter }: { refresh: () => void; focusAfter: (selector: string) => void }) {
  const [said, setSaid] = useState<MoveSaid>(null);

  async function move(row: RoleRow, direction: "up" | "down") {
    const neighbourId = direction === "up" ? row.upId : row.downId;
    if (!neighbourId) return;
    setSaid(null);
    try {
      const result = await moveRoleAction(row.id, direction, neighbourId);
      if (result.status === "moved") {
        setSaid({ id: row.id, text: `Moved ${result.name} ${direction === "up" ? "above" : "below"} ${result.past}`, refused: false });
        focusAfter(`[data-role-menu="${row.id}"], [data-role-fold="${row.name}"] h3 button`);
      } else if (result.status === "nesting") {
        setSaid({ id: row.id, text: `Can't move ${row.name} there. ${nestingText(result.problem)}`, refused: true });
      } else {
        setSaid({ id: row.id, text: refusalText(result, { role: row.name }).message, refused: true });
      }
      refresh();
    } catch {
      toast({ tone: "error", title: NETWORK_TEXT });
    }
  }

  return { move, said };
}
