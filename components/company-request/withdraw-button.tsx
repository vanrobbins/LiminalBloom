// Withdraw a waiting company request (spec 0.7.1 5.1, 5.2): asks first, then the card changes under the person
// (the page refreshes), so there is no toast. A lost connection is the one toast, as on the Help screens.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { withdrawCompanyRequestAction } from "@/app/(app)/request-company/actions";
import { useHelpCall } from "@/components/help/use-help-call";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function WithdrawButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { isBusy, call } = useHelpCall();
  const [isOpen, setIsOpen] = useState(false);

  async function withdraw() {
    const reply = await call(() => withdrawCompanyRequestAction(id));
    if (!reply) return;
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
        Withdraw
      </Button>
      {isOpen ? (
        <Dialog open onOpenChange={(open) => !open && setIsOpen(false)} title="Withdraw this request?" description={`Liminal Bloom will no longer look at your request for ${name}. You can ask again later.`}>
          <Button variant="danger" loading={isBusy} loadingText="Withdrawing…" onClick={withdraw}>
            Withdraw request
          </Button>
        </Dialog>
      ) : null}
    </>
  );
}
