// The top of the landing page: the brand mark, one large line of type, and the
// two ways in. Sign in is the gold primary action, since most visitors are a
// store team arriving for work; both stay above the fold on a phone.

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section aria-labelledby="landing-title" className="mx-auto w-full max-w-5xl px-6 pt-16 pb-16 md:px-10 md:pt-28 md:pb-24 lg:pt-36">
      <p className="flex items-center gap-3 text-lg font-semibold tracking-tight text-ink">
        <span aria-hidden="true" className="text-3xl leading-none text-brand">
          &#10052;
        </span>
        liminal bloom
      </p>
      <h1
        id="landing-title"
        className="mt-8 max-w-[13ch] text-5xl leading-[1.05] font-semibold tracking-tight text-ink md:mt-14 md:text-7xl lg:text-8xl"
      >
        Find any product on the floor in seconds.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-muted md:mt-8 md:text-xl">
        Liminal Bloom keeps your store map, product photos and planograms in one place, so the whole team works from
        the same plan, on the phone in their pocket.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 md:mt-10">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
    </section>
  );
}
