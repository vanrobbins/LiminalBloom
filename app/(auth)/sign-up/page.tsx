// Create an account. Client-side because it holds the pending and error
// states; everything else in the app stays a Server Component by default.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
            <a href="/sign-in">Already have an account? Sign in</a>
          </Button>
        </form>
      </Card>
    </main>
  );
}
