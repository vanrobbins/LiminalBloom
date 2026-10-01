// The home page. Next.js turns any `page.tsx` file into a route --
// this one sits at app/page.tsx, so it is the site root: "/".
// Save this file while `npm run dev` is running and the browser updates itself.

import { CornerThemeToggle } from "@/components/corner-theme-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <CornerThemeToggle />
      <div className="flex flex-col items-start gap-4">
        <span className="text-4xl" aria-hidden="true">
          &#10052;
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-ink">
          liminal bloom
        </h1>
        <p className="max-w-md text-lg text-ink-muted">
          A mobile-first visual merchandising platform for retail store teams.
        </p>
        <p className="mt-4 rounded border border-brand px-3 py-1 text-sm text-brand-strong">
          Week 1 &middot; foundation
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <a href="/sign-in">Sign in</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/sign-up">Create an account</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
