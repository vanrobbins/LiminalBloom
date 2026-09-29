// Create an account. Deliberately plain -- the designed version arrives with
// the component library in Week 2. This exists to prove auth works end to end.
//
// "use client" because this page has state and handles a submit event.
// Everything else in the app stays a Server Component by default.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setPending(false);

    if (error) {
      setError(error.message ?? "Could not create the account.");
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
          Create account
        </h1>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Name
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            className="min-h-11 rounded border border-line bg-raised px-3 text-base text-ink"
          />
        </label>

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
            minLength={8}
            autoComplete="new-password"
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
          {pending ? "Creating account…" : "Create account"}
        </button>

        <a
          href="/sign-in"
          className="text-sm text-brand-strong underline"
        >
          Already have an account? Sign in
        </a>
      </form>
    </main>
  );
}
