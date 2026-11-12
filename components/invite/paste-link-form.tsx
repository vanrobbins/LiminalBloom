// Accept by pasting the invite link or code, on /welcome (spec 0.7, 4.8; DECISIONS
// 11-12). It only finds the id and opens /invite/<id>, the one accept flow; the
// link is the secret (4.9), so this never lists or looks anything up itself.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseInviteLink } from "@/lib/invite-link";

export const NOT_A_LINK_TEXT = "That doesn't look like an invite link or code. Paste the whole link you were sent.";
export const EMPTY_TEXT = "Paste the invite link or code you were sent.";

export function PasteLinkForm() {
  const router = useRouter();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isOpening, setIsOpening] = useState(false);

  function accept(event: React.FormEvent) {
    event.preventDefault();
    const id = parseInviteLink(pasted);
    if (!id) {
      setError(pasted.trim() === "" ? EMPTY_TEXT : NOT_A_LINK_TEXT);
      return;
    }
    // Stays busy until the invitation page replaces this one.
    setError(undefined);
    setIsOpening(true);
    router.push(`/invite/${id}`);
  }

  return (
    <form onSubmit={accept} noValidate className="flex flex-col gap-2">
      <div aria-live="polite">
        <Input
          label="Invite link or code"
          name="invite"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={pasted}
          onChange={(event) => {
            setPasted(event.target.value);
            setError(undefined);
          }}
          error={error}
        />
      </div>
      <Button type="submit" loading={isOpening} loadingText="Opening…">
        Accept
      </Button>
    </form>
  );
}
