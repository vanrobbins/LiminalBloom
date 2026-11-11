// Accept an invitation, from the invitation page or /welcome (spec 0.7, 4.8). The
// server decides whether it still works; a refusal is worded in place, so the person
// isn't left guessing why nothing happened.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptInvitationAction } from "@/app/invite/[id]/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

import { acceptRefusalText, NETWORK_TEXT } from "./invite-text";

type AcceptButtonProps = {
  invitationId: string;
  storeName: string;
  label?: string;
  /** Names the invitation for a screen reader when the page lists several. */
  ariaLabel?: string;
};

export function AcceptButton({ invitationId, storeName, label = "Accept invitation", ariaLabel }: AcceptButtonProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function accept() {
    setIsBusy(true);
    setNotice(null);
    try {
      const result = await acceptInvitationAction(invitationId);
      if (result.status === "accepted") {
        // Stay disabled until the products page replaces this one.
        setDone(true);
        toast({ tone: "success", title: `Joined ${result.storeName} as ${result.roleName}` });
        router.replace("/products");
        router.refresh();
        return;
      }
      setNotice(acceptRefusalText(result, storeName));
    } catch {
      setNotice(NETWORK_TEXT);
    }
    setIsBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={accept} loading={isBusy || done} loadingText="Joining…" aria-label={isBusy || done ? undefined : ariaLabel}>
        {label}
      </Button>
      {notice ? (
        <p role="alert" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
