// The home page. Next.js turns any `page.tsx` file into a route --
// this one sits at app/page.tsx, so it is the site root: "/".
// Save this file while `npm run dev` is running and the browser updates itself.
//
// One page for two visitors (DECISIONS 11-02): a store team signing in, and a
// store deciding whether to use the app. The ways in come first; the scroll
// explains the product. A server component: only the theme toggle runs in the browser.

import type { Metadata } from "next";

import { CornerThemeToggle } from "@/components/corner-theme-toggle";
import { ClosingSection } from "@/components/landing/closing-section";
import { FeatureList } from "@/components/landing/feature-list";
import { LandingHero } from "@/components/landing/landing-hero";
import { PlanSection } from "@/components/landing/plan-section";

export const metadata: Metadata = {
  title: "Liminal Bloom: find any product on the floor",
  description:
    "Store maps, product photos, planograms and search for retail store teams, on the phone in their pocket.",
};

export default function Home() {
  return (
    <main className="flex-1 bg-surface">
      <CornerThemeToggle />
      <LandingHero />
      <PlanSection />
      <FeatureList />
      <ClosingSection />
    </main>
  );
}
