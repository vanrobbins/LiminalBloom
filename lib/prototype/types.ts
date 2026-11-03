// The walkthrough's chapters (the index page on branch feature/prototype-walkthrough).
// Each chapter is one screen of the app, drawn as a static mock, plus the
// explanation beside it. Numbered points tie a spot on the mock to a line of text.

import type { Route } from "@/lib/demo/route";

/** Where a chapter's feature stands on 2026-11-02. */
export type ChapterStatus = "about" | "live" | "next" | "planned";

export type ScreenId =
  | "core-loop"
  | "sign-in"
  | "store-map"
  | "products"
  | "locator"
  | "planogram"
  | "space"
  | "frame-run"
  | "palette"
  | "home"
  | "quick-adjust"
  | "review"
  | "my-day"
  | "checklist"
  | "ai-connection"
  | "request-path";

export type Point = {
  /** A short name for the spot on the screen. */
  title: string;
  text: string;
};

export type Chapter = {
  /** Used as the URL hash: ASCII letters, digits and hyphens. */
  id: string;
  status: ChapterStatus;
  title: string;
  lede: string;
  screen: ScreenId;
  /** Where "Try it" opens the working demo, if this screen is in it. */
  live?: { start: Route; sheet?: string };
  /** Point n here is marker n on the screen. */
  points: Point[];
  /** Why it works this way: the reasoning, in paragraphs. */
  why: string[];
  /** A short task, one action per step. */
  flow?: { title: string; steps: string[] };
  /** Tables, rules and code that make it work. */
  underTheHood: string[];
};
