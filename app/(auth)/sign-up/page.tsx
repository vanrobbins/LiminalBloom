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

    router.push("/account");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F2EA] px-6 dark:bg-[#16120F]">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-[#231D18] dark:text-[#F7F2EA]">
          Create account
        </h1>

        <label className="flex flex-col gap-1 text-sm text-[#231D18] dark:text-[#F7F2EA]">
          Name
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            className="min-h-11 rounded border border-[#231D18]/20 bg-white px-3 text-base text-[#231D18] dark:border-[#F7F2EA]/20 dark:bg-[#231D18] dark:text-[#F7F2EA]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[#231D18] dark:text-[#F7F2EA]">
          Work email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="min-h-11 rounded border border-[#231D18]/20 bg-white px-3 text-base text-[#231D18] dark:border-[#F7F2EA]/20 dark:bg-[#231D18] dark:text-[#F7F2EA]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[#231D18] dark:text-[#F7F2EA]">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="min-h-11 rounded border border-[#231D18]/20 bg-white px-3 text-base text-[#231D18] dark:border-[#F7F2EA]/20 dark:bg-[#231D18] dark:text-[#F7F2EA]"
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
          className="min-h-11 rounded bg-[#E8B93A] px-4 font-medium text-[#231D18] disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>

        <a
          href="/sign-in"
          className="text-sm text-[#6E5210] underline dark:text-[#E8B93A]"
        >
          Already have an account? Sign in
        </a>
      </form>
    </main>
  );
}
