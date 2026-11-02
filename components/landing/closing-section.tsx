// The end of the scroll, for a store deciding whether to use the app. Its link
// is named differently from the hero's, so each name leads to one link.

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ClosingSection() {
  return (
    <section aria-labelledby="closing-title" className="border-t border-line-subtle">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 md:px-10 md:py-24">
        <h2 id="closing-title" className="max-w-[18ch] text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Start with one store.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">
          Make an account, add your store and draw its floor. Then add your products and build the first planogram.
        </p>
        <div className="mt-8">
          <Button asChild variant="secondary">
            <Link href="/sign-up">Set up a store</Link>
          </Button>
        </div>
        <p className="mt-16 flex items-center gap-2 text-sm text-ink-muted">
          <span aria-hidden="true" className="text-brand-strong">
            &#10052;
          </span>
          liminal bloom
        </p>
      </div>
    </section>
  );
}
