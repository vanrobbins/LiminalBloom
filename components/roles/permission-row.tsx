// One permission as a row in a list: the phone's fold for a role, and the checklist in
// the New role dialog (spec 0.7, 4.8 parts 2 and 5). The whole row is the label, with a
// 44 px checkbox on the right. A nesting note shows under it in words: phones have no hover.

import { Lock } from "lucide-react";
import { useId } from "react";

import { labelOf } from "@/lib/access/roles-view";
import type { Switch } from "@/lib/access/switches";

type PermissionRowProps = {
  permission: Switch;
  checked: boolean;
  enabled: boolean;
  locked?: boolean;
  changed?: boolean;
  note?: string | null;
  /** Also names the control for the table-style query "<permission> for <role>"; the visible label stays the permission. */
  forRole?: string;
  /** The role's id, so the screen can send focus back to this checkbox. */
  roleId?: string;
  onToggle: () => void;
};

export function PermissionRow({ permission, checked, enabled, locked = false, changed = false, note = null, forRole, roleId, onToggle }: PermissionRowProps) {
  const noteId = useId();
  return (
    <div className={`rounded ${changed ? "bg-info-tint" : ""}`}>
      <label className="flex min-h-11 items-center justify-between gap-3 px-2 text-ink">
        <span>
          {labelOf(permission)}
          {locked ? <span className="sr-only">, always on</span> : null}
        </span>
        <span className="flex items-center gap-1">
          {locked ? <Lock aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-muted" /> : null}
          <input
            type="checkbox"
            checked={checked}
            disabled={!enabled}
            onChange={onToggle}
            aria-label={forRole ? `${labelOf(permission)} for ${forRole}${locked ? ", always on" : ""}` : undefined}
            aria-describedby={note ? noteId : undefined}
            data-role={roleId}
            data-permission={permission}
            className="size-6 accent-ink"
          />
        </span>
      </label>
      {note ? (
        <p id={noteId} className="px-2 pb-2 text-sm text-ink-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
