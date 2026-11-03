// The index page on the feature/prototype-walkthrough branch: a guided
// walkthrough of the app instead of the landing page. This branch is never
// merged (DECISIONS 11-02). Public and static: no sign-in, no database.

import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Walkthrough } from "@/components/prototype/walkthrough";

export const metadata: Metadata = {
  title: "Liminal Bloom: prototype walkthrough",
  description: "Every screen of Liminal Bloom, explained: what's live, what's being built and what's planned.",
};

export default function Home() {
  return (
    <div className="flex-1 bg-surface">
      <div className="border-b border-line-subtle">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-8">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-4 rounded-full bg-brand" />
            <span className="font-semibold tracking-tight text-ink">Liminal Bloom</span>
            <span className="hidden text-ink-muted sm:inline">· Prototype walkthrough</span>
          </span>
          <span className="flex items-center gap-2">
            <Link href="/demo" className="inline-flex min-h-11 items-center px-2 text-brand-strong underline underline-offset-4">
              Try the demo
            </Link>
            <a
              href="https://liminalbloom.vanar.me"
              className="hidden min-h-11 items-center px-2 text-brand-strong underline underline-offset-4 md:inline-flex"
            >
              Open the live app
            </a>
            <ThemeToggle />
          </span>
        </div>
      </div>
      <Walkthrough />
    </div>
  );
}
