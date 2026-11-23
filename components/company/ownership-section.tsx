// /company's Ownership, for the owner only (spec 0.7.1 5.5; the page shows it only to them, and the action refuses
// anyone else). With no corporate admin there is no one to hand to, so it says so and offers Invite; otherwise Hand
// off ownership opens a confirm with a choice of corporate admin. The result is off-screen (this section goes away
// for the old owner), so it is a toast, and the page reloads as a corporate admin.

"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { handOffOwnershipAction } from "@/app/(app)/company/ownership-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { toast } from "@/lib/toast";

import { ActionDialog } from "./action-dialog";
import { InviteCompanyDialog, type RegionChoice, type RoleChoice } from "./invite-company-dialog";

export type AdminChoice = { userId: string; name: string };

function HandOffDialog({ companyName, admins, version, opener, onClose }: { companyName: string; admins: AdminChoice[]; version: number; opener: HTMLElement | null; onClose: () => void }) {
  const router = useRouter();
  const [to, setTo] = useState(admins[0]?.userId ?? "");
  const name = admins.find((a) => a.userId === to)?.name ?? "";
  return (
    <ActionDialog
      title={`Hand off ${companyName}?`}
      description={`${name} becomes the owner. You stay as a corporate admin, and they can change that.`}
      confirm="Hand off"
      loadingText="Handing off…"
      danger
      opener={opener}
      onClose={onClose}
      onDone={() => {
        toast({ tone: "success", title: `${name} is now the owner`, description: "You are a corporate admin." });
        router.refresh();
      }}
      run={async () => {
        const reply = await handOffOwnershipAction(to, version);
        return reply.status === "handed" ? null : reply.message;
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="hand-off-to" className="text-sm text-ink">
          New owner
        </label>
        <select id="hand-off-to" value={to} onChange={(event) => setTo(event.target.value)} className={FIELD_CLASSES}>
          {admins.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </ActionDialog>
  );
}

export function OwnershipSection({ companyName, admins, version, roles, regions }: { companyName: string; admins: AdminChoice[]; version: number; roles: RoleChoice[]; regions: RegionChoice[] }) {
  const [open, setOpen] = useState<{ kind: "invite" | "handoff"; opener: HTMLElement | null } | null>(null);
  const shared = { opener: open?.opener ?? null, onClose: () => setOpen(null) };
  return (
    <Card compact role="region" id="ownership" aria-labelledby="ownership-heading">
      <h2 id="ownership-heading" className="mb-2 text-lg font-semibold text-ink">
        Ownership
      </h2>
      {admins.length === 0 ? (
        <>
          <p className="mb-3 text-ink">Appoint a corporate admin before you hand off ownership.</p>
          <Button variant="secondary" onClick={(event) => setOpen({ kind: "invite", opener: event.currentTarget })}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            Invite
          </Button>
        </>
      ) : (
        <>
          <p className="mb-3 text-ink">You own {companyName}. You can hand it to one of its corporate admins; you stay as a corporate admin.</p>
          <Button variant="secondary" onClick={(event) => setOpen({ kind: "handoff", opener: event.currentTarget })}>
            Hand off ownership
          </Button>
        </>
      )}
      {open?.kind === "invite" ? <InviteCompanyDialog {...shared} roles={roles} regions={regions} initialRole="corporate_admin" /> : null}
      {open?.kind === "handoff" ? <HandOffDialog {...shared} companyName={companyName} admins={admins} version={version} /> : null}
    </Card>
  );
}
