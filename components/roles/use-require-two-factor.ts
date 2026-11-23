// "Require two-factor" / "Stop requiring two-factor" from a role's menu (spec 0.7.1 1, A3b). Like a move it
// is a quick action with its result on screen (the role's row says "Requires two-factor"), so no toast: the
// outcome goes to the polite live region, a refusal also shows under the role's row, and only a lost
// connection is a toast.

"use client";

import { requireTwoFactorAction } from "@/app/(app)/store/roles/actions";
import type { RoleRow } from "@/lib/access/roles-view";
import { toast } from "@/lib/toast";

import { NETWORK_TEXT, refusalText } from "./refusal-text";
import type { MoveSaid } from "./use-move-role";

export function useRequireTwoFactor({ refresh, setSaid }: { refresh: () => void; setSaid: (said: MoveSaid) => void }) {
  return async function toggleTwoFactor(row: RoleRow) {
    setSaid(null);
    try {
      const result = await requireTwoFactorAction(row.id, row.version, !row.requiresTwoFactor);
      if (result.status === "set") {
        setSaid({ id: row.id, text: result.on ? `${result.name} now requires two-factor sign-in` : `${result.name} no longer requires two-factor sign-in`, refused: false });
      } else if (result.status !== "nesting") {
        setSaid({ id: row.id, text: refusalText(result, { role: row.name }).message, refused: true });
      }
      refresh();
    } catch {
      toast({ tone: "error", title: NETWORK_TEXT });
    }
  };
}
