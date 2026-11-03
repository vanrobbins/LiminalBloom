// Every walkthrough chapter in reading order.

import { CHAPTERS_LATER } from "./chapters-later";
import { CHAPTERS_LIVE } from "./chapters-live";
import { CHAPTERS_NEXT } from "./chapters-next";
import type { ChapterScope } from "./types";

export const CHAPTERS = [...CHAPTERS_LIVE, ...CHAPTERS_NEXT, ...CHAPTERS_LATER];

export const SCOPE_LABEL: Record<ChapterScope, string> = {
  included: "Included",
  planned: "Planned",
  nice: "Nice to have",
};

/** The chapter a URL hash names ("#store-map" or "store-map"), else the first. */
export function chapterIndex(hash: string): number {
  const id = hash.replace(/^#/, "");
  const index = CHAPTERS.findIndex((chapter) => chapter.id === id);
  return index === -1 ? 0 : index;
}
