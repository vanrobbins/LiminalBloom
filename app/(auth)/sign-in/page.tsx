// Sign in. Client-side because it holds the pending and error states.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={pending} loadingText="Signing in…">
            Sign in
          </Button>

          <Button asChild variant="ghost">
            <a href="/sign-up">Need an account? Create one</a>
          </Button>
        </form>
      </Card>
    </main>
  );
}
