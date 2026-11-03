// The walkthrough: chapter list, the chapter's explanation and its phone,
// which shows a drawing or the working demo. The chapter lives in the URL hash
// so each one has its own link; arrow keys, Back and Next move between them.

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CHAPTERS, chapterIndex } from "@/lib/prototype/chapters";

import { ChapterDetails } from "./chapter-details";
import { ChapterNav } from "./chapter-nav";
import { ChapterPoints } from "./chapter-points";
import { DemoStoreProvider } from "../demo/demo-store";
import { PhonePanel, type PhoneMode } from "./phone-panel";
import { PointContext } from "./point-context";
import { ScopeTag } from "./scope-tag";
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

  const [mode, setMode] = useState<PhoneMode>("explained");

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
      // Keys the demo used (arrows move a selected tile) or typed into it stay there.
      if (event.defaultPrevented || target.closest("[data-demo]")) return;
      if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      // Read the chapter now, not from the render that attached this, so a key
      // pressed straight after Next still moves on from the new chapter.
      const now = chapterIndex(window.location.hash);
      if (event.key === "ArrowRight" && now < CHAPTERS.length - 1) go(now + 1);
      if (event.key === "ArrowLeft" && now > 0) go(now - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DemoStoreProvider>
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
              {chapter.scope ? <ScopeTag scope={chapter.scope} /> : null}
            </p>
            <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-ink outline-none md:text-4xl">
              {chapter.title}
            </h1>
            <p className="text-lg text-ink-muted">{chapter.lede}</p>
            {index === 0 ? (
              <p className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/demo"
                  className="inline-flex min-h-11 items-center gap-1 rounded bg-brand px-4 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Open the demo
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMode("try")}
                  className="inline-flex min-h-11 items-center rounded border border-line bg-raised px-3 text-ink focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Try it in the phone
                </button>
              </p>
            ) : null}
          </header>

          <div className="md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start">
            <PhonePanel chapter={chapter} mode={mode} onMode={setMode} />
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
    </DemoStoreProvider>
  );
}
