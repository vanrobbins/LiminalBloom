// The walkthrough: chapter list, the chapter's explanation and its screen
// drawing. The chapter lives in the URL hash so each one has its own link;
// arrow keys, Back and Next move between them.

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CHAPTERS, chapterIndex } from "@/lib/prototype/chapters";

import { ChapterDetails } from "./chapter-details";
import { ChapterNav } from "./chapter-nav";
import { ChapterPoints } from "./chapter-points";
import { ChapterScreen } from "./chapter-screen";
import { PhoneFrame } from "./phone-frame";
import { PointContext } from "./point-context";
import { StatusTag } from "./status-tag";
import { useChapterHash } from "./use-chapter-hash";

function go(index: number) {
  window.location.hash = CHAPTERS[index].id;
}

export function Walkthrough() {
  const index = chapterIndex(useChapterHash());
  const chapter = CHAPTERS[index];
  const prev = index > 0 ? CHAPTERS[index - 1] : null;
  const next = index < CHAPTERS.length - 1 ? CHAPTERS[index + 1] : null;

  // A lit point belongs to its chapter, so it goes dark when the chapter changes.
  const [lit, setLit] = useState<{ id: string; n: number } | null>(null);
  const active = lit?.id === chapter.id ? lit.n : null;
  const choose = (n: number) => setLit(active === n ? null : { id: chapter.id, n });

  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(index);
  useEffect(() => {
    // Move focus and the scroll to the new chapter, but not on the first load.
    if (shown.current === index) return;
    shown.current = index;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    // Keep the current chapter visible in the sidebar's own scroll.
    document.querySelector('nav[aria-label="Chapters"] [aria-current="step"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight" && index < CHAPTERS.length - 1) go(index + 1);
      if (event.key === "ArrowLeft" && index > 0) go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  return (
    <PointContext.Provider value={{ active, choose }}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-6 pb-28 md:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <ChapterNav current={index} onGo={go} />
        </aside>

        <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-10">
          <header className="flex flex-col gap-3 md:col-start-1">
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span className="font-mono">
                {index + 1} / {CHAPTERS.length}
              </span>
              <span aria-hidden="true">·</span>
              {chapter.week}
              {chapter.status === "about" ? null : <StatusTag status={chapter.status} />}
            </p>
            <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-ink outline-none md:text-4xl">
              {chapter.title}
            </h1>
            <p className="text-lg text-ink-muted">{chapter.lede}</p>
          </header>

          <div className="md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start">
            <PhoneFrame label={`Drawing of the ${chapter.title} screen`}>
              <ChapterScreen id={chapter.screen} />
            </PhoneFrame>
          </div>

          <div className="flex flex-col gap-8 md:col-start-1">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-ink">On this screen</h2>
              <ChapterPoints points={chapter.points} />
            </section>
            <ChapterDetails chapter={chapter} />
          </div>
        </main>
      </div>

      <nav aria-label="Previous and next chapter" className="fixed inset-x-0 bottom-0 border-t border-line bg-raised">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-8">
          <button
            type="button"
            disabled={!prev}
            onClick={() => go(index - 1)}
            className="inline-flex min-h-11 min-w-0 items-center gap-1 rounded border border-line bg-raised px-3 text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
            <span className="truncate">{prev ? `Back: ${prev.title}` : "Back"}</span>
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => go(index + 1)}
            className="inline-flex min-h-11 min-w-0 items-center gap-1 rounded bg-brand px-4 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
          >
            <span className="truncate">{next ? `Next: ${next.title}` : "The end"}</span>
            <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
          </button>
        </div>
      </nav>
    </PointContext.Provider>
  );
}
