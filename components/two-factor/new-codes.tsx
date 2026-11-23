// "New backup codes" for an account that has two-factor on: the password, then ten new codes
// (the old ones stop working). The action is a prop so each page passes the one with its own guard.

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import type { CodesActionReply } from "@/lib/two-factor/replies";

import { CopyButton } from "./copy-button";

export function NewBackupCodes({ make }: { make: (password: string) => Promise<CodesActionReply> }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password"));
    setProblem(null);
    setPending(true);
    try {
      const reply = await make(password);
      if (reply.status === "refused") setProblem(reply.message);
      else {
        form.reset();
        setCodes(reply.backupCodes);
      }
    } catch {
      setProblem(CONNECTION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="new-codes">
      <h2 id="new-codes" className="text-lg font-semibold text-ink">
        Backup codes
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input label="Password" name="password" type="password" required autoComplete="current-password" hint="Your password, to make sure it is you." />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" className="self-start" loading={pending} loadingText="Making…">
          New backup codes
        </Button>
      </form>
      {codes ? (
        <>
          <p className="text-sm text-ink-muted">Save these somewhere safe. The old ones no longer work.</p>
          <div className="flex items-start gap-2">
            <ul className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 rounded border border-line bg-surface px-3 py-2 font-mono text-sm text-ink">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <CopyButton text={codes.join("\n")} label="Copy backup codes" />
          </div>
        </>
      ) : null}
    </section>
  );
}
