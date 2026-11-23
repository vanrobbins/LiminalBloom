// A role on a phone (spec 0.7, 4.8 part 2): a fold whose title is the role and whose summary
// says how many permissions it has, "Your role" or "Above you". Open, one row per permission,
// the live "This role can:" list, and the role's actions as buttons at the foot.

"use client";

import { ArrowDown, ArrowUp, Pencil, RotateCcw, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";

import { Fold } from "@/components/ui/fold";
import { Button } from "@/components/ui/button";
import { cellEnabled, EDITABLE_SWITCHES, permissionCount, roleActions, type RoleAction, type RoleRow, type RolesView } from "@/lib/access/roles-view";
import { summaryLines } from "@/lib/access/switches";

import { PermissionRow } from "./permission-row";
import { cellNote, switchesOf, type Staged } from "./staged";
import type { MoveSaid } from "./use-move-role";

const ACTION_ICON: Record<RoleAction, LucideIcon> = { "two-factor": ShieldCheck, rename: Pencil, up: ArrowUp, down: ArrowDown, reset: RotateCcw, delete: Trash2 };

type RoleFoldProps = {
  view: RolesView;
  row: RoleRow;
  staged: Staged;
  /** Why the last move was refused, shown under that role's title. */
  refusal: MoveSaid;
  open: boolean;
  onOpen: () => void;
  onToggle: (row: RoleRow, permission: (typeof EDITABLE_SWITCHES)[number]) => void;
  onAction: (row: RoleRow, action: RoleAction, opener: HTMLElement) => void;
};

export function RoleFold({ view, row, staged, refusal, open, onOpen, onToggle, onAction }: RoleFoldProps) {
  const mine = switchesOf(row, staged);
  const anyStaged = Object.keys(staged).length > 0;
  const summary = row.relation === "you" ? "Your role" : row.relation === "above" ? "Above you" : permissionCount(mine);
  return (
    <div data-role-fold={row.name} data-role-id={row.id}>
      <Fold title={staged[row.id] ? `${row.name} (unsaved)` : row.name} summary={summary} open={open} onToggle={onOpen}>
        {EDITABLE_SWITCHES.map((s) => {
          const enabled = cellEnabled(row, s, view.holds);
          return (
            <PermissionRow
              key={s}
              permission={s}
              forRole={row.name}
              roleId={row.id}
              checked={mine.includes(s)}
              enabled={enabled}
              locked={row.locked.includes(s)}
              changed={staged[row.id] !== undefined && staged[row.id].includes(s) !== row.switches.includes(s)}
              note={enabled ? cellNote(view.roles, staged, row, s) : null}
              onToggle={() => onToggle(row, s)}
            />
          );
        })}
        {row.requiresTwoFactor ? <p className="px-2 text-sm text-ink-muted">Requires two-factor sign-in.</p> : null}
        <div className="px-2">
          <p className="text-sm font-medium text-ink">This role can:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
            {summaryLines(mine).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {roleActions(row).length > 0 ? (
          <div className="flex flex-wrap gap-2 px-2">
            {roleActions(row).map((a) => {
              const Icon = ACTION_ICON[a.key];
              return (
                <Button key={a.key} icon variant={a.key === "delete" ? "quiet-danger" : "secondary"} disabled={anyStaged} onClick={(event) => onAction(row, a.key, event.currentTarget)} aria-label={`${a.label} ${row.name}`}>
                  <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </Button>
              );
            })}
            {anyStaged ? <p className="w-full text-sm text-ink-muted">Save or discard your changes first.</p> : null}
          </div>
        ) : null}
      </Fold>
      {refusal?.id === row.id ? (
        <p aria-hidden="true" className="px-2 pb-2 text-sm text-danger">
          {refusal.text}
        </p>
      ) : null}
    </div>
  );
}
