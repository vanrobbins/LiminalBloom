// The code step of sign-in for an account with two-factor on (spec 0.7.1 8.3): the six digits from
// the authenticator app, or a backup code. Better Auth holds the half-finished sign-in in a cookie for
// 10 minutes and limits the tries, so nothing is kept here. The browser calls the two verify routes,
// which stay open on purpose. "Trust this device for 30 days" (A3b) skips the code at the next password sign-in
// from this browser. That sign-in has no `two_factor_at`, so a Liminal Bloom admin is still asked for a code at /admin.

"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CodeField, type CodeMethod } from "@/components/two-factor/code-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import { authHref, safeReturnPath } from "@/lib/return-path";
import { twoFactorRefusal, type SignInRefusal } from "@/lib/two-factor/sign-in-refusal";

export function TwoFactorForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [method, setMethod] = useState<CodeMethod>("totp");
  const [problem, setProblem] = useState<SignInRefusal | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code")).trim();
    const trustDevice = data.get("trustDevice") === "on";

    let refusal: SignInRefusal | null = null;
    try {
      const { error } = method === "backup" ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice }) : await authClient.twoFactor.verifyTotp({ code, trustDevice });
      if (error) refusal = twoFactorRefusal(error, method);
    } catch {
      refusal = { message: CONNECTION_ERROR, restart: false };
    }

    if (refusal) {
      setPending(false);
      setProblem(refusal);
      return;
    }
    // Still "Verifying…" until the next page replaces this one.
    router.push(safeReturnPath(next) ?? "/home");
    router.refresh();
  }

  function swapMethod() {
    setMethod(method === "totp" ? "backup" : "totp");
    setProblem(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Two-step sign-in</h1>
          <p className="text-ink-muted">{method === "backup" ? "Enter one of your backup codes." : "Enter the code from your authenticator app."}</p>

          {/* Keyed by method so swapping starts with an empty field. */}
          <CodeField key={method} method={method} />

          {/* The real checkbox is the 44 px row, see-through and on top; the box beside it is only the picture of it. */}
          <label className="group relative flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="trustDevice" className="peer absolute inset-0 h-11 w-full cursor-pointer opacity-0" />
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded border border-line bg-raised group-has-checked:border-brand group-has-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
            >
              <Check strokeWidth={2.5} className="size-4 text-on-brand opacity-0 group-has-checked:opacity-100" />
            </span>
            Trust this device for 30 days
          </label>

          {problem ? (
            <p role="alert" className="text-sm text-danger">
              {problem.message}
            </p>
          ) : null}
          {problem?.restart ? (
            <Button asChild variant="secondary">
              <a href={authHref("/sign-in", next)}>Sign in again</a>
            </Button>
          ) : null}

          <Button type="submit" loading={pending} loadingText="Verifying…">
            Verify
          </Button>
          <Button type="button" variant="ghost" onClick={swapMethod}>
            {method === "backup" ? "Use the app code instead" : "Use a backup code instead"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
