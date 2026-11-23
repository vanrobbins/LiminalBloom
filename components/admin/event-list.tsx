// platform_events as the admin screens show them (spec 0.7.1 7.5): what was done, to what, by whom, why,
// and when. Rows on a phone and tablet and in the overview; the activity page adds a table from 1024 px.
// Plain text only: a reason is typed by an admin and is never rendered as HTML.

import { LocalTime } from "@/components/time/local-time";
import { eventLabel } from "@/lib/admin/event-kinds";
import type { AdminEvent } from "@/lib/admin/reads";

export function EventList({ events, className = "" }: { events: AdminEvent[]; className?: string }) {
  if (events.length === 0) return <p className="text-ink-muted">Nothing has been done yet.</p>;
  return (
    <ul className={`flex flex-col divide-y divide-line-subtle ${className}`.trim()}>
      {events.map((e) => (
        <li key={e.id} className="flex flex-col gap-1 py-3">
          <p className="wrap-break-word text-ink">
            <span className="font-medium">{eventLabel(e.action)}</span>
            {e.targetLabel ? `: ${e.targetLabel}` : null}
          </p>
          <p className="wrap-break-word text-sm text-ink-muted">
            {e.actorName} · <LocalTime at={e.createdAt} />
          </p>
          <p className="wrap-break-word text-sm text-ink-muted">{e.reason}</p>
        </li>
      ))}
    </ul>
  );
}

export function EventTable({ events }: { events: AdminEvent[] }) {
  if (events.length === 0) return null;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="sticky top-0 border-b border-line bg-surface text-ink-muted">
          <th scope="col" className="py-2 pr-4 font-medium">When</th>
          <th scope="col" className="py-2 pr-4 font-medium">What</th>
          <th scope="col" className="py-2 pr-4 font-medium">By</th>
          <th scope="col" className="py-2 font-medium">Reason</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-subtle align-top">
        {events.map((e) => (
          <tr key={e.id}>
            <td className="py-3 pr-4 whitespace-nowrap text-ink-muted">
              <LocalTime at={e.createdAt} />
            </td>
            <td className="py-3 pr-4 wrap-break-word text-ink">
              <span className="font-medium">{eventLabel(e.action)}</span>
              {e.targetLabel ? <span className="block text-ink-muted">{e.targetLabel}</span> : null}
            </td>
            <td className="py-3 pr-4 wrap-break-word text-ink-muted">{e.actorName}</td>
            <td className="py-3 wrap-break-word text-ink-muted">{e.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
