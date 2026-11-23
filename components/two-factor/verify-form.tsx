// The admin step-up: a fresh authenticator code for a session that has none or an old one (spec 0.7.1
// 8.3, /admin/verify). The action is a prop so the page passes the one with the admin guard.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import type { VerifyActionReply } from "@/lib/two-factor/replies";

import { CodeField } from "./code-field";

export function VerifyForm({ verify, doneHref }: { verify: (code: string) => Promise<VerifyActionReply>; doneHref: string }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    setProblem(null);
    setPending(true);
    try {
      const reply = await verify(code);
      if (reply.status === "refused") {
        setProblem(reply.message);
        setPending(false);
        return;
      }
      // Still "Checking…" until the next page replaces this one.
      router.push(doneHref);
      router.refresh();
    } catch {
      setProblem(CONNECTION_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Confirm it&apos;s you</h1>
      <p className="text-ink-muted">Enter the code from your authenticator app.</p>
      <CodeField />
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <Button type="submit" loading={pending} loadingText="Checking…">
        Verify
      </Button>
    </form>
  );
}
