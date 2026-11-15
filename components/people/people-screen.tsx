// The People screen's body (spec 0.7, 4.8): everyone in the store grouped by role,
// highest rank first. Everyone sees the same hierarchy; the server decides what a
// viewer is sent (emails, invitations) and which rows have buttons. The dialogs
// and their focus rules live here (4.8 part 8).

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InfoPopover } from "@/components/ui/info-popover";
import type { PeopleView, PersonRow } from "@/lib/access/people-view";
import { toast } from "@/lib/toast";

import { ChangeRoleDialog } from "./change-role-dialog";
import { InvitationsCard } from "./invitations-card";
import { PersonListItem } from "./person-row";
import { RemovePersonDialog } from "./remove-person-dialog";

type Open = { kind: "role"; person: PersonRow } | { kind: "remove"; person: PersonRow } | null;

export function PeopleScreen({ view, storeName }: { view: PeopleView; storeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  // After a change the row may move to another group once the list reloads; focus follows it.
  const focusAfter = useRef<string | null>(null);
  const removedRow = useRef(false);
  // Radix returns focus to a Trigger, and these dialogs have none (they open from state), so the screen does it.
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (focusAfter.current === null) return;
    document.querySelector<HTMLElement>(`[data-change-role="${focusAfter.current}"]`)?.focus();
    focusAfter.current = null;
  }, [view]);

  const everyone = view.groups.flatMap((g) => g.people);
  const onlyYou = everyone.length === 1 && everyone[0].isYou;

  function openFrom(button: HTMLElement, next: NonNullable<Open>) {
    opener.current = button;
    setOpen(next);
  }

  function backToOpener(event: Event) {
    event.preventDefault();
    opener.current?.focus();
  }

  // The removed row is gone, so focus goes to the page title; it takes focus only by script.
  function focusTitle(event: Event) {
    if (!removedRow.current) return backToOpener(event);
    removedRow.current = false;
    event.preventDefault();
    const title = document.querySelector<HTMLElement>("h1");
    title?.setAttribute("tabindex", "-1");
    title?.focus();
  }

  return (
    <>
      {view.canManage ? null : (
        <p className="mb-6 inline-flex items-center gap-1 text-ink-muted">
          Everyone in the store can see who&apos;s here. Your role can&apos;t change it.
          <InfoPopover term="role" />
        </p>
      )}
      {view.invitations.length > 0 ? <InvitationsCard invitations={view.invitations} /> : null}
      {view.groups.map((group) => (
        <section key={group.key} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-ink">
            {group.roleName} · {group.people.length}
          </h2>
          <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
            {group.people.map((p) => (
              <PersonListItem key={p.memberId} person={p} onChangeRole={(person, button) => openFrom(button, { kind: "role", person })} onRemove={(person, button) => openFrom(button, { kind: "remove", person })} />
            ))}
          </ul>
          {view.isSoleManager && group.people.some((p) => p.isYou) ? (
            <p className="mt-2 flex items-center gap-1 text-sm text-ink-muted">
              A store always keeps one Store Manager.
              <InfoPopover term="storeManager" />
            </p>
          ) : null}
        </section>
      ))}
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
              toast({ tone: "success", title: `Changed ${changed.name} to ${changed.roleName}` });
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
          onCloseAutoFocus={focusTitle}
          onClose={(removedName) => {
            if (removedName) {
              removedRow.current = true;
              toast({ tone: "success", title: `Removed ${removedName}` });
              router.refresh();
            }
            setOpen(null);
          }}
        />
      ) : null}
    </>
  );
}
