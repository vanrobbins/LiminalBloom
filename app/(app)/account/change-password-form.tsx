// The Change password card on Account. Signing everyone else out is not a choice here
// (the action always asks for it), so the card says so instead of offering a box. The form
// folds behind a "Change password" button (0.7.0.5 spec 3.4) and folds shut again, with focus
// back on that button, once the password is changed.

"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const bodyId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
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
        setIsOpen(false);
        trigger.current?.focus();
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
      <Button ref={trigger} variant="secondary" className="self-start" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setIsOpen((now) => !now)}>
        Change password
      </Button>
      {/* One grid row, 0fr to 1fr; inert while folded so its fields can't be tabbed to. */}
      <div id={bodyId} inert={!isOpen} className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-[190ms] motion-safe:ease-[var(--ease-enter)] ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <form onSubmit={save} className="flex flex-col gap-4 p-1">
            <Input label="Current password" name="current" type="password" required autoComplete="current-password" error={errorFor("current")} />
            <Input label="New password" name="new" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} error={errorFor("new")} />
            <Input label="Confirm new password" name="confirm" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" error={errorFor("confirm")} />
            {problem && !problem.field ? (
              <p role="alert" className="text-sm text-danger">
                {problem.message}
              </p>
            ) : null}
            <Button type="submit" className="self-start" loading={isSaving} loadingText="Saving…">
              Save new password
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
