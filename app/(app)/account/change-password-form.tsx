// The Change password card on Account. Signing everyone else out is not a choice here
// (the action always asks for it), so the card says so instead of offering a box.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import { MIN_PASSWORD } from "@/lib/password-limits";
import { toast } from "@/lib/toast";

import { changePasswordAction } from "./actions";

type Field = "current" | "new" | "confirm";

export function ChangePasswordForm() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState<{ field?: Field; message: string } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setProblem(null);
    setIsSaving(true);
    try {
      const reply = await changePasswordAction(data.get("current"), data.get("new"), data.get("confirm"));
      if (reply.status === "saved") {
        form.reset();
        toast({ tone: "success", title: reply.message });
        // The person's session was replaced; the page reads the new one.
        router.refresh();
      } else {
        setProblem({ field: reply.field, message: reply.message });
      }
    } catch {
      setProblem({ message: CONNECTION_ERROR });
    } finally {
      setIsSaving(false);
    }
  }

  const errorFor = (field: Field) => (problem?.field === field ? problem.message : undefined);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Change password</h2>
      <p className="text-sm text-ink-muted">Changing it signs you out everywhere else, on every phone, tablet and computer, but not here.</p>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Input label="Current password" name="current" type="password" required autoComplete="current-password" error={errorFor("current")} />
        <Input label="New password" name="new" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} error={errorFor("new")} />
        <Input label="Confirm new password" name="confirm" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" error={errorFor("confirm")} />
        {problem && !problem.field ? (
          <p role="alert" className="text-sm text-danger">
            {problem.message}
          </p>
        ) : null}
        <Button type="submit" className="self-start" loading={isSaving} loadingText="Saving…">
          Change password
        </Button>
      </form>
    </Card>
  );
}
