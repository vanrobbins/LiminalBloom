// The sign-in form. Client-side because it holds the pending and error states;
// page.tsx around it reads the return path (an invitation link comes through here).

"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import { authHref, safeReturnPath } from "@/lib/return-path";

/** `next` is where to go afterwards: a path on this site, or nothing for the usual first page. */
export function SignInForm({ next }: { next: string | null }) {
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
      const { error } = await signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
        // Better Auth: false = a cookie that ends with the browser and a 24-hour session;
        // true = 7 days, extended each day. Off unless ticked: store tablets are shared.
        rememberMe: form.get("rememberMe") === "on",
      });
      // Deliberately vague: saying which of the two was wrong tells an
      // attacker whether an email address has an account here.
      if (error) failure = error.status === 429 ? "Too many sign-in attempts. Wait a moment, then try again." : "That email and password do not match.";
    } catch {
      failure = CONNECTION_ERROR;
    }

    if (failure) {
      setPending(false);
      setError(failure);
      return;
    }

    // Still "Signing in…" until /products replaces this page. Clearing it
    // here left an idle button for the second the server took to render.
    router.push(safeReturnPath(next) ?? "/products");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign in</h1>

          <Input label="Work email" name="email" type="email" required autoComplete="email" />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />

          {/* The real checkbox is the 44 px row, see-through and on top; the box beside it is only the picture of it. */}
          <label className="group relative flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="rememberMe" className="peer absolute inset-0 h-11 w-full cursor-pointer opacity-0" />
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded border border-line bg-raised group-has-checked:border-brand group-has-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
            >
              <Check strokeWidth={2.5} className="size-4 text-on-brand opacity-0 group-has-checked:opacity-100" />
            </span>
            Keep me signed in
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={pending} loadingText="Signing in…">
            Sign in
          </Button>

          <Button asChild variant="ghost">
            <a href={authHref("/sign-up", next)}>Need an account? Create one</a>
          </Button>
        </form>
      </Card>
    </main>
  );
}
