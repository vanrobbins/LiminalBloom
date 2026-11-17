// The wide form of the grid, from 768 px (spec 0.7, 4.8 part 2): roles down the side, top
// rank first, one column per permission, then the ⋯ menu. It scrolls sideways inside its
// own region, never the page. The role name is sticky so it stays beside the cells.

"use client";

import { Fragment } from "react";

import { cellEnabled, EDITABLE_SWITCHES, labelOf, roleActions, type RoleAction, type RolesView, type RoleRow } from "@/lib/access/roles-view";

import { PermissionCell } from "./permission-cell";
import { RoleMenu } from "./role-menu";
import type { MoveSaid } from "./use-move-role";
import { cellNote, switchesOf, type Staged } from "./staged";

type RoleTableProps = {
  view: RolesView;
  staged: Staged;
  /** Why the last move was refused, shown under that role's row. */
  refusal: MoveSaid;
  onToggle: (row: RoleRow, permission: (typeof EDITABLE_SWITCHES)[number]) => void;
  onAction: (row: RoleRow, action: RoleAction, opener: HTMLElement) => void;
};

export function RoleTable({ view, staged, refusal, onToggle, onAction }: RoleTableProps) {
  const anyStaged = Object.keys(staged).length > 0;
  return (
    <div role="region" aria-label="Permissions by role" tabIndex={0} className="relative overflow-x-auto rounded-lg border border-line-subtle bg-raised">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Permissions by role</caption>
        <thead>
          <tr className="border-b border-line-subtle text-left">
            <th scope="col" className="sticky left-0 z-10 min-w-40 bg-raised px-3 py-2 font-medium text-ink">
              Role
            </th>
            {EDITABLE_SWITCHES.map((s) => (
              <th key={s} scope="col" className="min-w-24 px-2 py-2 text-center font-medium text-ink">
                {labelOf(s)}
              </th>
            ))}
            <th scope="col" className="w-14 px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {view.roles.map((row) => {
            const mine = switchesOf(row, staged);
            return (
              <Fragment key={row.id}>
                <tr className="border-b border-line-subtle last:border-0">
                  <th scope="row" tabIndex={-1} data-role-name={row.name} className="sticky left-0 z-10 bg-raised px-3 py-2 text-left font-medium text-ink outline-none">
                    <span className="wrap-break-word">{row.name}</span>
                    {staged[row.id] ? <span className="block text-xs font-normal text-ink">Unsaved</span> : null}
                    {row.relation ? <span className="block text-xs font-normal text-ink-muted">{row.relation === "you" ? "Your role" : "Above you"}</span> : null}
                  </th>
                  {EDITABLE_SWITCHES.map((s) => (
                    <PermissionCell
                      key={s}
                      row={row}
                      permission={s}
                      checked={mine.includes(s)}
                      enabled={cellEnabled(row, s, view.holds)}
                      changed={staged[row.id] !== undefined && staged[row.id].includes(s) !== row.switches.includes(s)}
                      note={cellEnabled(row, s, view.holds) ? cellNote(view.roles, staged, row, s) : null}
                      onToggle={() => onToggle(row, s)}
                    />
                  ))}
                  <td className="px-2 py-1 text-center">
                    <RoleMenu row={row} disabledHint={anyStaged ? "Save or discard your changes first." : null} onAction={onAction} actions={roleActions(row)} />
                  </td>
                </tr>
                {refusal?.id === row.id ? (
                  <tr className="border-b border-line-subtle last:border-0">
                    <td colSpan={EDITABLE_SWITCHES.length + 2} aria-hidden="true" className="px-3 pb-2 text-sm text-danger">
                      {refusal.text}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
