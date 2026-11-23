// Turning two-step sign-in off, from Account: the password and a current code from the app (spec 0.7.1 8.3,
// A3b). The action is a prop (it carries the Account guard). A refusal stays under the fields; once it is
// off the page is read again by the card that holds this form.

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import type { DisableActionReply } from "@/lib/two-factor/replies";

import { CodeField } from "./code-field";

type Props = { disable: (password: string, code: string) => Promise<DisableActionReply>; onOff: () => void; onCancel: () => void };

export function TurnOffForm({ disable, onOff, onCancel }: Props) {
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setProblem(null);
    setPending(true);
    try {
      const reply = await disable(String(data.get("password")), String(data.get("code")).trim());
      if (reply.status === "refused") setProblem(reply.message);
      else onOff();
    } catch {
      setProblem(CONNECTION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 data-focus-heading className="text-base font-semibold text-ink">
        Turn off two-step sign-in
      </h3>
      <p className="text-sm text-ink-muted">Your password and a current code from your authenticator app.</p>
      <Input label="Password" name="password" type="password" required autoComplete="current-password" />
      <CodeField />
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="quiet-danger" loading={pending} loadingText="Turning off…">
          Turn off two-step sign-in
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
