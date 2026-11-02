// My Day: VM blocks in time order, the current one open with its
// tasks and their locations.

import { Check } from "lucide-react";

import { Marker } from "../marker";
import { MockScreen } from "../mock/mock-screen";

const TASKS = [
  { what: "Refold straight denim", where: "Denim wall · Bottom shelf", done: true },
  { what: "Set wide-leg into the gap", where: "Denim wall · 1½–3½ ft from left", done: false },
];

export function MyDayScreen() {
  return (
    <MockScreen title="My Day" tab="home">
      <span className="text-xs text-ink-muted">Monday, November 2 · Pioneer Place</span>
      <span className="flex gap-3 text-xs text-ink-muted">
        <span className="w-10 font-mono">9:00</span>
        <span className="flex-1 rounded-lg border border-line px-3 py-2">Floor</span>
      </span>
      <div className="flex gap-3 text-xs">
        <span className="w-10 font-mono text-ink-muted">10:00</span>
        <section className="flex flex-1 flex-col gap-2 rounded-lg border-2 border-brand bg-raised p-3">
          <span className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Denim refold</span>
            <span className="flex items-center gap-1">
              <span className="rounded-full bg-ink px-2 py-0.5 font-medium text-surface">Now</span>
              <Marker n={1} />
            </span>
          </span>
          {TASKS.map((task, i) => (
            <span key={task.what} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${task.done ? "border-ink bg-ink text-surface" : "border-line"}`}
              >
                {task.done ? <Check strokeWidth={2.5} className="size-3" /> : null}
              </span>
              <span className="flex-1">
                <span className={`block text-ink ${task.done ? "line-through" : ""}`}>{task.what}</span>
                <span className="block text-ink-muted">{task.where}</span>
              </span>
              {i === 1 ? <Marker n={2} /> : null}
            </span>
          ))}
          <span className="flex items-center justify-between text-ink-muted">
            With Jordan <Marker n={3} />
          </span>
        </section>
      </div>
      <span className="flex gap-3 text-xs text-ink-muted">
        <span className="w-10 font-mono">2:00</span>
        <span className="flex-1 rounded-lg border border-line px-3 py-2">Front table reset</span>
      </span>
      <section className="mt-auto flex items-center justify-between rounded-lg border border-dashed border-line p-3 text-xs text-ink">
        Not yet scheduled · 2 tasks <Marker n={4} />
      </section>
    </MockScreen>
  );
}
