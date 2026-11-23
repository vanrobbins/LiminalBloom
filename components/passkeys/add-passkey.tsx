// "Add a passkey": the password first (the server then allows one registration for five minutes), then the
// browser's own passkey prompt, then the name. Better Auth's registration would also use a name as the
// authenticator's own label for the account, so the name is set after, by the rename action, and the
// authenticator keeps showing the email. Spec 0.7.1 8.4, A3c.

"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { CONNECTION_ERROR } from "@/lib/connection-error";

import type { PasskeyActions } from "./types";

// Better Auth's and the browser's codes for the ways adding can end without a passkey.
function addProblem(error: { code?: string; message?: string }): string | null {
  if (error.code === "ERROR_CEREMONY_ABORTED" || error.code === "AUTH_CANCELLED") return null;
  if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || error.code === "PREVIOUSLY_REGISTERED") return "This device already has a passkey for your account.";
  if (error.code === "SESSION_NOT_FRESH") return "Sign out and sign in again, then add the passkey.";
  return "Couldn't add the passkey. Try again.";
}

export function AddPasskey({ allow, rename, onAdded, first }: Pick<PasskeyActions, "allow" | "rename"> & { onAdded: () => void; first: boolean }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setProblem(null);
    setPending(true);
    try {
      const allowed = await allow(String(data.get("password")));
      if (allowed.status === "refused") {
        setProblem(allowed.message);
        return;
      }
      const { data: added, error } = await authClient.passkey.addPasskey();
      if (error || !added) {
        setProblem(error ? addProblem(error) : "Couldn't add the passkey. Try again.");
        return;
      }
      const name = String(data.get("name")).trim();
      // A failed rename only leaves the default name: the passkey itself is saved.
      if (name !== "") await rename(added.id, name).catch(() => undefined);
      setOpen(false);
      onAdded();
    } catch {
      setProblem(CONNECTION_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        {first ? "Add a passkey" : "Add another passkey"}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input label="Name" name="name" maxLength={60} autoComplete="off" hint="So you can tell it from your others, like Work laptop." />
      <Input label="Password" name="password" type="password" required autoComplete="current-password" hint="Your password, to make sure it is you." />
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} loadingText="Adding…">
          Add passkey
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
