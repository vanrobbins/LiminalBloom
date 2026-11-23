// The dialog every admin help action opens (spec 0.7.1 7.4, 12): what will happen, a Reason (required, 5 to
// 500 characters, shown in the log) and the confirm. A refusal shows inline, where the person is looking; a
// finished pause, restore or sign-out is a toast (R2: the result is out of sight, on a page that reloads).
// On success the page is refreshed and the dialog closes.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { NETWORK_TEXT } from "@/components/people/refusal-text";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cleanReason, MAX_REASON, MIN_REASON } from "@/lib/admin/reason";
import { type AdminReply, replyText, type ReplyStatus } from "@/lib/admin/replies";
import { toast } from "@/lib/toast";

export type ReasonDialogProps = {
  title: string;
  description: string;
  confirm: string;
  loadingText: string;
  variant?: Extract<ButtonVariant, "primary" | "danger">;
  /** Runs the action with the trimmed reason. */
  run: (reason: string) => Promise<AdminReply>;
  onClose: () => void;
  /** A toast on success; without it the page reloading is the confirmation. */
  doneToast?: string;
  /** The row this opened from is gone once it is done (a cancelled invitation): focus goes to the page title, not the vanished button. */
  rowGoes?: boolean;
  /** The hint under the Reason field, where the reason is shown to more than the admin log. */
  hint?: string;
  /** Wording for a refusal this action says differently. */
  messages?: Partial<Record<ReplyStatus, string>>;
};

export function ReasonDialog({ title, description, confirm, loadingText, variant = "primary", run, onClose, doneToast, rowGoes = false, hint, messages }: ReasonDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const done = useRef(false);
  const valid = cleanReason(reason) !== null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || isBusy || isFinal) return;
    setIsBusy(true);
    setNotice(null);
    try {
      const reply = await run(reason.trim());
      if (reply.status === "done") {
        done.current = true;
        if (doneToast) toast({ tone: "success", title: doneToast });
        router.refresh();
        onClose();
        return;
      }
      const { message, final } = replyText(reply.status, messages);
      setNotice(message);
      setIsFinal(final);
    } catch {
      setNotice(NETWORK_TEXT);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        if (isFinal) router.refresh();
        onClose();
      }}
      title={title}
      description={description}
      onCloseAutoFocus={(event) => {
        const heading = rowGoes && done.current ? document.querySelector<HTMLElement>("h1") : null;
        if (!heading) return;
        event.preventDefault();
        heading.tabIndex = -1;
        heading.focus();
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Reason" hint={hint ?? `Shown in the admin log. ${MIN_REASON} to ${MAX_REASON} characters.`} value={reason} maxLength={MAX_REASON} autoComplete="off" autoFocus required onChange={(e) => setReason(e.target.value)} />
        <p role="status" className="text-sm text-danger empty:hidden">
          {notice}
        </p>
        <Button type="submit" variant={variant} loading={isBusy} loadingText={loadingText} disabled={!valid || isFinal}>
          {confirm}
        </Button>
      </form>
    </Dialog>
  );
}
