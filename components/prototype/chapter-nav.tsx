// The chapter list: every chapter in reading order, one numbered list, each
// with its place in the proposal's scope (included, planned, nice to have).
// A sidebar from 1024 px; a native picker below that.

import { CHAPTERS, SCOPE_LABEL } from "@/lib/prototype/chapters";

export function ChapterNav({ current, onGo }: { current: number; onGo: (index: number) => void }) {
  const chapters = CHAPTERS.map((chapter, index) => ({ ...chapter, index }));

  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-ink-muted lg:hidden">
        Jump to a chapter
        <select
          value={current}
          onChange={(event) => onGo(Number(event.target.value))}
          className="min-h-11 w-full min-w-0 rounded border border-line bg-raised px-3 text-base text-ink"
        >
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.index}>
              {chapter.index + 1}. {chapter.title}
              {chapter.scope ? ` · ${SCOPE_LABEL[chapter.scope]}` : ""}
            </option>
          ))}
        </select>
      </label>

      <nav aria-label="Chapters" className="hidden lg:block">
        <ol className="flex flex-col">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                aria-current={chapter.index === current ? "step" : undefined}
                className="flex min-h-11 items-baseline gap-2 rounded px-3 py-1.5 text-ink hover:bg-line-subtle focus-visible:outline-2 focus-visible:outline-ink aria-[current=step]:bg-brand aria-[current=step]:text-on-brand"
              >
                <span className="w-5 shrink-0 text-right font-mono text-xs opacity-70">{chapter.index + 1}</span>
                <span className="flex flex-col">
                  <span className="text-sm leading-snug font-medium">{chapter.title}</span>
                  {chapter.scope ? <span className="text-xs opacity-70">{SCOPE_LABEL[chapter.scope]}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
