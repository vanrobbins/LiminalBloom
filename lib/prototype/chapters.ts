// Every walkthrough chapter in reading order: live, being built now, planned.

import { CHAPTERS_LATER } from "./chapters-later";
import { CHAPTERS_LIVE } from "./chapters-live";
import { CHAPTERS_NEXT } from "./chapters-next";
import type { ChapterStatus } from "./types";

export const CHAPTERS = [...CHAPTERS_LIVE, ...CHAPTERS_NEXT, ...CHAPTERS_LATER];

export const STATUS_LABEL: Record<ChapterStatus, string> = {
  about: "Overview",
  live: "Live now",
  next: "Building now",
  planned: "Planned",
};

/** The chapter a URL hash names ("#store-map" or "store-map"), else the first. */
export function chapterIndex(hash: string): number {
  const id = hash.replace(/^#/, "");
  const index = CHAPTERS.findIndex((chapter) => chapter.id === id);
  return index === -1 ? 0 : index;
}
