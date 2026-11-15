// One permission of one role in the wide table (spec 0.7, 4.8 part 2): a centred 44 px
// target holding a native checkbox. Named "<permission> for <role>"; a locked one says
// "always on" and shows a lock. A changed cell is tinted, and its role's name cell says
// "Unsaved" (text as well as colour). A nesting note is the cell's title and description.

import { Lock } from "lucide-react";
import { useId } from "react";

import type { RoleRow } from "@/lib/access/roles-view";
import { labelOf } from "@/lib/access/roles-view";
import type { Switch } from "@/lib/access/switches";

type PermissionCellProps = {
  row: RoleRow;
  permission: Switch;
  checked: boolean;
  enabled: boolean;
  changed: boolean;
  note: string | null;
  onToggle: () => void;
};

export function PermissionCell({ row, permission, checked, enabled, changed, note, onToggle }: PermissionCellProps) {
  const noteId = useId();
  const locked = row.locked.includes(permission);
  const name = `${labelOf(permission)} for ${row.name}${locked ? ", always on" : ""}`;
  return (
    <td className={`p-0 text-center ${changed ? "bg-info-tint" : ""}`}>
      <label title={note ?? undefined} className="mx-auto flex min-h-11 min-w-11 items-center justify-center gap-1">
        <input
          type="checkbox"
          checked={checked}
          disabled={!enabled}
          onChange={onToggle}
          aria-label={name}
          aria-describedby={note ? noteId : undefined}
          data-permission={permission}
          data-role={row.id}
          className="size-5 accent-ink"
        />
        {locked ? <Lock aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-muted" /> : null}
      </label>
      {note ? (
        <span id={noteId} className="sr-only">
          {note}
        </span>
      ) : null}
    </td>
  );
}
