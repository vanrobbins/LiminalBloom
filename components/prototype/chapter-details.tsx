// Everything under a chapter's points: the reasoning, a short task, and what
// makes it work underneath.

import type { Chapter } from "@/lib/prototype/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-subtle pt-6">
      <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function ChapterDetails({ chapter }: { chapter: Chapter }) {
  return (
    <div className="flex flex-col gap-8">
      <Section title="Why it works this way">
        <div className="flex flex-col gap-3 text-ink-muted">
          {chapter.why.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Section>

      {chapter.flow ? (
        <Section title={chapter.flow.title}>
          <ol className="flex flex-col gap-2">
            {chapter.flow.steps.map((step, i) => (
              <li key={step} className="flex items-baseline gap-3 text-ink">
                <span className="w-5 shrink-0 text-right font-mono text-sm text-ink-muted">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      <Section title="Under the hood">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-muted marker:text-line">
          {chapter.underTheHood.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
