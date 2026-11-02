// The chapter list, which doubles as the timeline: chapters in reading order,
// grouped where neighbours share a standing (live, building now, planned).
// A sidebar from 1024 px; a native picker below that.

import { CHAPTERS, STATUS_LABEL } from "@/lib/prototype/chapters";
import type { Chapter } from "@/lib/prototype/types";

type Listed = Chapter & { index: number };

/** Runs of neighbouring chapters with the same status, in order. */
function groups(chapters: Listed[]) {
  const runs: { label: string; chapters: Listed[] }[] = [];
  for (const chapter of chapters) {
    const last = runs.at(-1);
    if (last && last.chapters[0].status === chapter.status) last.chapters.push(chapter);
    else runs.push({ label: chapter.status === "about" ? (chapter.index === 0 ? "Overview" : "Architecture") : STATUS_LABEL[chapter.status], chapters: [chapter] });
  }
  return runs;
}

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
            </option>
          ))}
        </select>
      </label>

      <nav aria-label="Chapters" className="hidden lg:block">
        {groups(chapters).map((group) => (
          <div key={group.chapters[0].id} className="mb-5">
            <h2 className="mb-1 px-3 text-sm font-medium text-ink-muted">{group.label}</h2>
            <ol>
              {group.chapters.map((chapter) => (
                <li key={chapter.id}>
                  <a
                    href={`#${chapter.id}`}
                    aria-current={chapter.index === current ? "step" : undefined}
                    className="flex min-h-11 items-center rounded px-3 py-1.5 text-ink hover:bg-line-subtle focus-visible:outline-2 focus-visible:outline-ink aria-[current=step]:bg-brand aria-[current=step]:text-on-brand"
                  >
                    <span className="text-sm leading-snug font-medium">{chapter.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </nav>
    </>
  );
}
