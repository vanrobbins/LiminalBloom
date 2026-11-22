// A new custom role (spec 0.7, 4.8 part 5): a name, where it goes (below your own role or any role
// under it), and its permissions, with the live "This role can:" list. Only permissions the viewer holds
// can be turned on. While the choice wouldn't nest with the roles around the chosen place, the dialog
// names the blocking role and Add role stays off; the server checks the same.

"use client";

import { Label } from "radix-ui";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { createRoleAction } from "@/app/(app)/store/roles/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { nestingProblem, nestingText } from "@/lib/access/nesting";
import { EDITABLE_SWITCHES, type RolesView } from "@/lib/access/roles-view";
import { SWITCHES, summaryLines, type Switch } from "@/lib/access/switches";

import { PermissionRow } from "./permission-row";
import { NETWORK_TEXT, refusalText } from "./refusal-text";

type AddRoleDialogProps = {
  view: RolesView;
  onClose: (addedName: string | null) => void;
  onCloseAutoFocus: (event: Event) => void;
};

export function AddRoleDialog({ view, onClose, onCloseAutoFocus }: AddRoleDialogProps) {
  const router = useRouter();
  const placeId = useId();
  const [name, setName] = useState("");
  const [belowId, setBelowId] = useState(view.placements[view.placements.length - 1]?.id ?? "");
  const [chosen, setChosen] = useState<Switch[]>(["view"]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // Only the order matters to the nesting rule, so the new role sits half a step below its place.
  const below = view.roles.find((r) => r.id === belowId);
  const problem = below
    ? nestingProblem([...view.roles.map((r) => ({ id: r.id, name: r.name, rank: r.rank, switches: r.switches, was: r.switches })), { id: "(new)", name: name.trim() || "The new role", rank: below.rank + 0.5, switches: chosen }])
    : null;

  const toggle = (s: Switch) => setChosen((now) => SWITCHES.filter((x) => (x === s ? !now.includes(x) : now.includes(x))));

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      const result = await createRoleAction(name, belowId, chosen);
      if (result.status === "created") return onClose(result.name);
      const { message, stale } = refusalText(result, { role: below?.name ?? "A role", name: name.trim(), action: "add" });
      setNotice(message);
      setIsStale(stale);
    } catch {
      setNotice(NETWORK_TEXT);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        if (isStale) router.refresh();
        onClose(null);
      }}
      title="New role"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form onSubmit={add} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} autoFocus disabled={isStale} />
        <div className="flex flex-col gap-1">
          <Label.Root htmlFor={placeId} className="text-sm text-ink">
            Place it
          </Label.Root>
          <select id={placeId} value={belowId} onChange={(event) => setBelowId(event.target.value)} className={FIELD_CLASSES} disabled={isStale}>
            {view.placements.map((p) => (
              <option key={p.id} value={p.id}>
                Below {p.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col">
          <legend className="text-sm text-ink">Permissions</legend>
          {EDITABLE_SWITCHES.map((s) => (
            <PermissionRow key={s} permission={s} checked={chosen.includes(s)} enabled={view.holds.includes(s) && !isStale} onToggle={() => toggle(s)} />
          ))}
        </fieldset>
        <div>
          <p className="text-sm font-medium text-ink">This role can:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
            {summaryLines(chosen).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {problem ? (
          <p role="status" className="text-sm text-danger">
            {nestingText(problem, true)}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-danger">
            {notice}
          </p>
        ) : null}
        <Button type="submit" loading={isSaving} loadingText="Adding…" disabled={isStale || name.trim() === "" || problem !== null}>
          Add role
        </Button>
      </form>
    </Dialog>
  );
}
