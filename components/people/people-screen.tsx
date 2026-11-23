// The People screen's body (spec 0.7, 4.8): everyone in the store in one list, each row
// naming its role, the viewer first and then by rank (11-22, Van; was one group per role).
// Everyone sees the same order; the server decides what a
// viewer is sent (emails, invitations) and which rows have buttons. The dialogs
// and their focus rules live here (4.8 part 8).

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InfoPopover } from "@/components/ui/info-popover";
import { focusNearRow } from "@/components/ui/focus-near-row";
import { useAnnouncement } from "@/components/ui/use-announcement";
import { useCollapseOut } from "@/components/ui/use-collapse-out";
import { peopleInOrder, type PeopleView, type PersonRow } from "@/lib/access/people-view";

import { ChangeRoleDialog } from "./change-role-dialog";
import { InvitationsCard } from "./invitations-card";
import { PersonListItem } from "./person-row";
import { RegionalManagers } from "./regional-managers";
import { RemovePersonDialog } from "./remove-person-dialog";

type Open = { kind: "role"; person: PersonRow } | { kind: "remove"; person: PersonRow } | null;

export function PeopleScreen({ view, storeName }: { view: PeopleView; storeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  // After a change the row may move once the list reloads; focus follows it.
  const focusAfter = useRef<string | null>(null);
  const removedRow = useRef(false);
  // No toast for a role change or a removal (0.7.0.5 spec 3.1): the row moves to its new place or folds shut,
  // and this line says it again to a screen reader.
  const [said, setSaid] = useAnnouncement();
  // A removal whose reload failed: the row opens again with this on it.
  const { isLeaving, collapse } = useCollapseOut();
  // Radix returns focus to a Trigger, and these dialogs have none (they open from state), so the screen does it.
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (focusAfter.current === null) return;
    document.querySelector<HTMLElement>(`[data-change-role="${focusAfter.current}"]`)?.focus();
    focusAfter.current = null;
  }, [view]);

  const everyone = peopleInOrder(view.groups);
  const onlyYou = everyone.length === 1 && everyone[0].isYou;

  function openFrom(button: HTMLElement, next: NonNullable<Open>) {
    opener.current = button;
    setOpen(next);
  }

  function backToOpener(event: Event) {
    event.preventDefault();
    opener.current?.focus();
  }

  // The removed row is folding away, so focus goes to its neighbour, else the list's heading or the page title.
  function focusNeighbour(event: Event) {
    if (!removedRow.current) return backToOpener(event);
    removedRow.current = false;
    event.preventDefault();
    const row = opener.current?.closest("li") ?? null;
    focusNearRow(row, row?.closest("section")?.querySelector<HTMLElement>("h2") ?? null);
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
      {view.canManage ? null : (
        <p className="mb-6 inline-flex items-center gap-1 text-ink-muted">
          Everyone in the store can see who&apos;s here. Your role can&apos;t change it.
          <InfoPopover term="role" />
        </p>
      )}
      <RegionalManagers managers={view.regionalManagers} />
      {view.invitations.length > 0 ? <InvitationsCard invitations={view.invitations} /> : null}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-ink">People · {everyone.length}</h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
          {everyone.map((p) => (
            <PersonListItem key={p.memberId} person={p} leaving={isLeaving(p.memberId)} onChangeRole={(person, button) => openFrom(button, { kind: "role", person })} onRemove={(person, button) => openFrom(button, { kind: "remove", person })} />
          ))}
        </ul>
        {view.isSoleManager ? (
          <p className="mt-2 flex items-center gap-1 text-sm text-ink-muted">
            A store always keeps one Store Manager.
            <InfoPopover term="storeManager" />
          </p>
        ) : null}
      </section>
      {onlyYou ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-center text-ink-muted">
          <p>Only you so far.</p>
          {view.assignable.length > 0 ? <p>Invite someone to add them to the store.</p> : null}
        </div>
      ) : null}
      {open?.kind === "role" ? (
        <ChangeRoleDialog
          key={open.person.memberId}
          person={open.person}
          roles={view.assignable}
          onCloseAutoFocus={(event) => {
            if (focusAfter.current !== null) event.preventDefault();
            else backToOpener(event);
          }}
          onClose={(changed) => {
            if (changed) {
              setSaid(`Changed ${changed.name} to ${changed.roleName}`);
              focusAfter.current = open.person.memberId;
              router.refresh();
            }
            setOpen(null);
          }}
        />
      ) : null}
      {open?.kind === "remove" ? (
        <RemovePersonDialog
          key={open.person.memberId}
          person={open.person}
          storeName={storeName}
          onCloseAutoFocus={focusNeighbour}
          onClose={(removedName) => {
            if (removedName) {
              removedRow.current = true;
              setSaid(`Removed ${removedName}`);
              const id = open.person.memberId;
              collapse(id, () => router.refresh());
            }
            setOpen(null);
          }}
        />
      ) : null}
    </>
  );
}
