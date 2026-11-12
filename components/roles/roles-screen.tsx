// The Roles screen (spec 0.7, 4.8 "Roles screen design"): what each role can do, edited in one staged
// batch with a summary before saving, plus rename, add, move, reset and delete. The server decides
// which rows and cells are editable and checks every write again, with the nesting rule over the
// whole saved batch (DECISIONS 11-11). The dialogs and their focus rules live here (part 8): they
// open from state, so Radix has no Trigger to return focus to and the screen does it.

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { moveRoleAction } from "@/app/(app)/roles/actions";
import { PageHeader } from "@/components/shell/page-header";
import { InfoPopover } from "@/components/ui/info-popover";
import { nestingText } from "@/lib/access/nesting";
import { EDITABLE_SWITCHES, type RoleAction, type RoleRow, type RolesView } from "@/lib/access/roles-view";
import type { Switch } from "@/lib/access/switches";
import { toast } from "@/lib/toast";

import { ActivityCard } from "./activity-card";
import { AddRoleButton } from "./add-role-button";
import { AddRoleDialog } from "./add-role-dialog";
import { DeleteDialog } from "./delete-dialog";
import { NETWORK_TEXT, refusalText } from "./refusal-text";
import { RenameDialog } from "./rename-dialog";
import { ResetDialog } from "./reset-dialog";
import { ReviewDialog } from "./review-dialog";
import { RoleFold } from "./role-fold";
import { RoleTable } from "./role-table";
import { changedRows, stagedProblem, toggled, type Staged } from "./staged";
import { StagedBar } from "./staged-bar";
import { useFocusAfter } from "./use-focus-after";

type Open = { kind: "review" } | { kind: "add" } | { kind: "rename" | "reset" | "delete"; row: RoleRow } | null;

export function RolesScreen({ view }: { view: RolesView }) {
  const router = useRouter();
  const [staged, setStaged] = useState<Staged>({});
  const [open, setOpen] = useState<Open>(null);
  const [openFolds, setOpenFolds] = useState<ReadonlySet<string>>(new Set());
  // A role just added opens its fold, until a fold is next touched.
  const [added, setAdded] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { focusAfter, armTitle, takeTitle } = useFocusAfter();

  const count = Object.keys(staged).length;
  const problem = stagedProblem(view.roles, staged);
  const hold = count > 0 ? "Save or discard your changes first." : undefined;
  const toggle = (row: RoleRow, permission: Switch) => setStaged((now) => toggled(now, row, permission));

  // After Save or Discard focus goes to the first checkbox that was changed.
  function firstChanged() {
    const row = changedRows(view.roles, staged)[0];
    const permission = row && EDITABLE_SWITCHES.find((s) => staged[row.id].includes(s) !== row.switches.includes(s));
    return row && permission ? `input[data-role="${row.id}"][data-permission="${permission}"]` : null;
  }

  function openFrom(trigger: HTMLElement, next: NonNullable<Open>) {
    opener.current = trigger;
    setOpen(next);
  }

  function onAction(row: RoleRow, action: RoleAction, trigger: HTMLElement) {
    if (action === "up" || action === "down") return void move(row, action);
    openFrom(trigger, { kind: action, row });
  }

  async function move(row: RoleRow, direction: "up" | "down") {
    const neighbourId = direction === "up" ? row.upId : row.downId;
    if (!neighbourId) return;
    try {
      const result = await moveRoleAction(row.id, direction, neighbourId);
      if (result.status === "moved") {
        toast({ tone: "success", title: `Moved ${result.name} ${direction === "up" ? "above" : "below"} ${result.past}` });
        focusAfter(`[data-role-menu="${row.id}"], [data-role-fold="${row.name}"] h3 button`);
      } else if (result.status === "nesting") {
        toast({ tone: "error", title: `Can't move ${row.name} there`, description: nestingText(result.problem) });
      } else {
        toast({ tone: "error", title: refusalText(result, { role: row.name }).message });
      }
      router.refresh();
    } catch {
      toast({ tone: "error", title: NETWORK_TEXT });
    }
  }

  function backToOpener(event: Event) {
    event.preventDefault();
    opener.current?.focus();
  }

  const finish = (title: string, focus?: () => void) => {
    toast({ tone: "success", title });
    focus?.();
    router.refresh();
    setOpen(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Roles and permissions"
        back={{ href: "/people", label: "People" }}
        actions={<AddRoleButton holdBack={hold} onOpen={(trigger) => openFrom(trigger, { kind: "add" })} />}
      />
      <p className="mb-4 inline-flex items-center gap-1 text-ink-muted">
        Every role can view the store: search products and see the map and published planograms.
        <InfoPopover term="permission" />
      </p>
      <p aria-live="polite" className="sr-only">
        {count === 0 ? "" : count === 1 ? "1 role changed" : `${count} roles changed`}
      </p>
      <div className="hidden md:block">
        <RoleTable view={view} staged={staged} onToggle={toggle} onAction={onAction} />
      </div>
      <div className="flex flex-col md:hidden">
        {view.roles.map((row) => (
          <RoleFold
            key={row.id}
            view={view}
            row={row}
            staged={staged}
            open={openFolds.has(row.id) || row.name === added}
            onOpen={() => {
              setAdded(null);
              setOpenFolds((now) => new Set(now.has(row.id) ? [...now].filter((id) => id !== row.id) : [...now, row.id]));
            }}
            onToggle={toggle}
            onAction={onAction}
          />
        ))}
      </div>
      {count > 0 ? (
        <StagedBar
          count={count}
          problem={problem ? nestingText(problem) : null}
          onDiscard={() => {
            focusAfter(firstChanged());
            setStaged({});
          }}
          onReview={(trigger) => openFrom(trigger, { kind: "review" })}
        />
      ) : null}
      <ActivityCard lines={view.activity} />
      {open?.kind === "review" ? (
        <ReviewDialog
          rows={view.roles}
          staged={staged}
          onCloseAutoFocus={backToOpener}
          onClose={(saved, stale) => {
            if (saved === null) {
              if (stale) setStaged({});
              return setOpen(null);
            }
            finish(`Saved changes to ${saved === 1 ? "1 role" : `${saved} roles`}`, () => focusAfter(firstChanged()));
            setStaged({});
          }}
        />
      ) : null}
      {open?.kind === "add" ? (
        <AddRoleDialog
          view={view}
          onCloseAutoFocus={backToOpener}
          onClose={(name) => {
            if (name === null) return setOpen(null);
            setAdded(name);
            finish(`Added ${name}`, () => focusAfter(`[data-role-name="${name}"], [data-role-fold="${name}"] button`));
          }}
        />
      ) : null}
      {open?.kind === "rename" ? (
        <RenameDialog key={open.row.id} row={open.row} onCloseAutoFocus={backToOpener} onClose={(done) => (done ? finish(`Renamed ${done.from} to ${done.to}`) : setOpen(null))} />
      ) : null}
      {open?.kind === "reset" ? (
        <ResetDialog key={open.row.id} row={open.row} onCloseAutoFocus={backToOpener} onClose={(name) => (name ? finish(`Reset ${name}`) : setOpen(null))} />
      ) : null}
      {open?.kind === "delete" ? (
        <DeleteDialog
          key={open.row.id}
          row={open.row}
          destinations={view.roles.filter((r) => r.editable)}
          canMovePeople={view.canMovePeople}
          onCloseAutoFocus={(event) => (takeTitle() ? event.preventDefault() : backToOpener(event))}
          onClose={(done) => (done ? finish(done, armTitle) : setOpen(null))}
        />
      ) : null}
    </div>
  );
}
