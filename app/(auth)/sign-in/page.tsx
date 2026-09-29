// Sign in. Plain by design, same as sign-up -- replaced in Week 2.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setPending(false);

    if (error) {
      // Deliberately vague: saying which of the two was wrong tells an
      // attacker whether an email address has an account here.
      setError("That email and password do not match.");
      return;
    }

    router.push("/products");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Work email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="min-h-11 rounded border border-line bg-raised px-3 text-base text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="min-h-11 rounded border border-line bg-raised px-3 text-base text-ink"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-brand px-4 font-medium text-on-brand disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <a
          href="/sign-up"
          className="text-sm text-brand-strong underline"
        >
          Need an account? Create one
        </a>
      </form>
    </main>
  );
}
