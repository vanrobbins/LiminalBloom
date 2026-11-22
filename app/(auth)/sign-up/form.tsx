// The create-account form. Client-side because it holds the pending and error
// states; everything else in the app stays a Server Component by default.
// page.tsx around it reads the return path (an invitation link comes through here).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth-client";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import { authHref, safeReturnPath } from "@/lib/return-path";

/** `next` is where to go afterwards: a path on this site, or nothing for the usual first page. */
export function SignUpForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    // Offline, the request rejects instead of returning { error }.
    let failure: string | null = null;
    try {
      // Better Auth's default is a 7-day session; new staff joining on a shared store tablet
      // start short, like sign-in does until "Keep me signed in" is ticked. The server accepts
      // rememberMe on sign-up but the client's types leave it out, so the body is built apart
      // (a variable is not checked for extra keys).
      const body = {
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        rememberMe: false,
      };
      const { error } = await signUp.email(body);
      if (error) failure = error.message || "Could not create the account.";
    } catch {
      failure = CONNECTION_ERROR;
    }

    if (failure) {
      setPending(false);
      setError(failure);
      return;
    }

    // Still "Creating account…" until /home replaces this page. Clearing
    // it here left an idle button for the second the server took to render.
    router.push(safeReturnPath(next) ?? "/home");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Create account
          </h1>

          <Input label="Name" name="name" required autoComplete="name" />
          <Input label="Work email" name="email" type="email" required autoComplete="email" />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            hint="At least 8 characters."
          />

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={pending} loadingText="Creating account…">
            Create account
          </Button>

          <Button asChild variant="ghost">
            <a href={authHref("/sign-in", next)}>Already have an account? Sign in</a>
          </Button>
        </form>
      </Card>
    </main>
  );
}
