// "Use a passkey" for the admin step-up (spec 0.7.1 8.4, A3c). A passkey sign-in is a new session with
// `two_factor_at` set by the session hook (lib/auth-factors.ts), which meets the 12-hour rule; the step-up
// swaps the session cookie for it, and the page then reads that session. Better Auth's
// verify-authentication does not tie the passkey to the account that is signed in now: any passkey in the
// browser can sign in as its own account. So what keeps another account's passkey out of /admin is the
// guard there, which looks at who the new session belongs to (not an admin: not found), never at this prompt.

"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient, signIn } from "@/lib/auth-client";
import { CONNECTION_ERROR } from "@/lib/connection-error";

const QUIET = new Set(["AUTH_CANCELLED", "ERROR_CEREMONY_ABORTED"]);

type Props = { doneHref: string; variant?: "primary" | "secondary"; /** Deletes the session the admin came with once the passkey made a new one (it is stale, and still signed in). */ dropOld?: (oldSessionId: string) => Promise<unknown> };

export function UsePasskey({ doneHref, variant = "secondary", dropOld }: Props) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function use() {
    setProblem(null);
    setPending(true);
    try {
      // The browser is the only one that knows the old session's id: ask before the passkey signs in as a new one.
      const oldId = dropOld ? await authClient.getSession().then((got) => got.data?.session.id, () => undefined) : undefined;
      const reply = await signIn.passkey();
      if (reply?.data) {
        // The new session is in place. A failure leaves the old one to expire: the person is signed in either way.
        if (dropOld && oldId) await dropOld(oldId).catch(() => undefined);
        // Still waiting until the next page replaces this one.
        router.push(doneHref);
        router.refresh();
        return;
      }
      if (reply?.error && !QUIET.has(String((reply.error as { code?: string }).code))) setProblem("That passkey didn't work. Try again.");
    } catch {
      setProblem(CONNECTION_ERROR);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variant} loading={pending} loadingText="Waiting for your passkey…" onClick={() => void use()}>
        <KeyRound aria-hidden="true" strokeWidth={1.75} className="size-5" />
        Use a passkey
      </Button>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
