// One passkey on Account: its name, when it was added and last used, and Rename and Remove. Remove asks for
// the password; a refusal (the last passkey of an account that needs two-factor, a wrong password) stays in
// the row. Spec 0.7.1 8.4, A3c.

"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import type { PasskeyReply } from "@/lib/passkeys/replies";
import { formatDay } from "@/lib/planograms/dates";

import type { PasskeyActions, PasskeyItem } from "./types";

const dayOf = (date: Date | null) => (date ? formatDay(new Date(date).toISOString().slice(0, 10)) : null);

type Props = { item: PasskeyItem; onChanged: () => void } & Pick<PasskeyActions, "rename" | "remove">;

export function PasskeyRow({ item, rename, remove, onChanged }: Props) {
  const [mode, setMode] = useState<"view" | "rename" | "remove">("view");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const label = item.name ?? "Passkey";
  const added = dayOf(item.createdAt);
  const used = dayOf(item.lastUsedAt);

  async function run(work: () => Promise<PasskeyReply>) {
    setProblem(null);
    setPending(true);
    try {
      const reply = await work();
      if (reply.status === "refused") setProblem(reply.message);
      else {
        setMode("view");
        onChanged();
      }
    } catch {
      setProblem(CONNECTION_ERROR);
    } finally {
      setPending(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(() => (mode === "rename" ? rename(item.id, String(data.get("name"))) : remove(item.id, String(data.get("password")))));
  }

  function cancel() {
    setMode("view");
    setProblem(null);
  }

  if (mode === "view") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-ink wrap-break-word">{label}</span>
          <span className="text-sm text-ink-muted">{[added ? `Added ${added}` : null, used ? `Last used ${used}` : "Not used yet"].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex shrink-0 gap-1">
          <Button icon variant="ghost" aria-label={`Rename ${label}`} onClick={() => setMode("rename")}>
            <Pencil aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
          <Button icon variant="ghost" aria-label={`Remove ${label}`} onClick={() => setMode("remove")}>
            <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
        </span>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {mode === "rename" ? (
        <Input label="Name" name="name" required maxLength={60} defaultValue={item.name ?? ""} autoComplete="off" />
      ) : (
        <Input label={`Password, to remove ${label}`} name="password" type="password" required autoComplete="current-password" />
      )}
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {mode === "rename" ? (
          <Button type="submit" loading={pending} loadingText="Saving…">
            Save name
          </Button>
        ) : (
          <Button type="submit" variant="quiet-danger" loading={pending} loadingText="Removing…">
            Remove passkey
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
