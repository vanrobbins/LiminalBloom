// Recent changes (spec 0.7, 4.8 part 6): the latest access events for the store, newest first, one
// line each with the time in the viewer's own time zone. The text is written on the server, so an
// email in an invitation event reaches only someone who may manage people.

import { LocalTime } from "@/components/time/local-time";
import { Card } from "@/components/ui/card";
import type { ActivityLine } from "@/lib/access/roles-view";

export function ActivityCard({ lines }: { lines: ActivityLine[] }) {
  return (
    <Card compact className="mt-6">
      <h2 className="text-lg font-semibold text-ink">Recent changes</h2>
      {lines.length === 0 ? (
        <p className="mt-2 text-ink-muted">No changes yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.id} className="text-sm text-ink wrap-break-word">
              {line.text} <span className="text-ink-muted">· <LocalTime at={line.at} /></span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
