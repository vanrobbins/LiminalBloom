// Close a request (spec 0.7.1 9.2): an icon button that asks first, since a closed request takes no more replies.
// Closing frees one of the person's five places. A refusal shows in the dialog; a lost connection is the one toast.

"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { closeHelpAction } from "@/app/(app)/help/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { REFUSAL_TEXT } from "@/lib/help/limits";

import { useHelpCall } from "./use-help-call";

export function CloseButton({ id }: { id: string }) {
  const router = useRouter();
  const { isBusy, call } = useHelpCall();
  const [isOpen, setIsOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function close() {
    setProblem(null);
    const reply = await call(() => closeHelpAction(id));
    if (!reply) return;
    if (reply.status === "done" || reply.status === "closed" || reply.status === "gone") {
      setIsOpen(false);
      router.refresh();
      return;
    }
    setProblem(REFUSAL_TEXT[reply.status]);
  }

  return (
    <>
      <Button icon variant="secondary" aria-label="Close request" onClick={() => setIsOpen(true)}>
        <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </Button>
      {isOpen ? (
        <Dialog open onOpenChange={(open) => !open && setIsOpen(false)} title="Close this request?" description="Liminal Bloom won't see more replies on it. You can ask again if you still need help.">
          <p role="status" className="text-sm text-danger empty:hidden">
            {problem}
          </p>
          <Button loading={isBusy} loadingText="Closing…" onClick={close}>
            Close request
          </Button>
        </Dialog>
      ) : null}
    </>
  );
}
