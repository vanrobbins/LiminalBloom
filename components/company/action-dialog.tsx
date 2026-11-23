// The dialog every /company write that needs a confirm shares (spec 0.7.1 12, R3: dialogs keep their confirm): the
// fields as children, one confirm button with words, and the server's refusal in words inside the dialog. `run`
// answers null when it worked, or the text to show; a lost connection is shown here too (no toast: R2).
// Focus returns to the control that opened it, or to the page title when that control is gone (a deleted row).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONNECTION_ERROR } from "@/lib/connection-error";

export type ActionDialogProps = {
  title: string;
  description?: string;
  confirm: string;
  loadingText: string;
  danger?: boolean;
  /** The control that opened it, to give focus back to. */
  opener: HTMLElement | null;
  onClose: () => void;
  run: () => Promise<string | null>;
  /** After a success: the default reloads the page's data. */
  onDone?: () => void;
  /** False while the fields are not yet fit to send. */
  ready?: boolean;
  children?: React.ReactNode;
};

export function ActionDialog({ title, description, confirm, loadingText, danger = false, opener, onClose, run, onDone, ready = true, children }: ActionDialogProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const problem = await run();
      if (problem !== null) return setNotice(problem);
      if (onDone) onDone();
      else router.refresh();
      onClose();
    } catch {
      setNotice(CONNECTION_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (opener?.isConnected) return opener.focus();
        const heading = document.querySelector<HTMLElement>("h1");
        heading?.setAttribute("tabindex", "-1");
        heading?.focus();
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {children}
        {notice ? (
          <p role="alert" className="text-sm text-danger">
            {notice}
          </p>
        ) : null}
        <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} loadingText={loadingText} disabled={!ready}>
          {confirm}
        </Button>
      </form>
    </Dialog>
  );
}
