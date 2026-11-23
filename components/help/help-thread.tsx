// A thread, oldest first (spec 0.7.1 9.2). Each message is "You" or "Liminal Bloom", never an admin's name (the
// query never carries one), with its time on the device. Bodies are plain text: React escapes them and the
// line breaks stay.

import { LocalTime } from "@/components/time/local-time";
import type { ThreadMessage } from "@/lib/help/queries";

export function HelpThread({ messages }: { messages: ThreadMessage[] }) {
  return (
    <ul aria-label="Messages" className="flex flex-col gap-3">
      {messages.map((m) => (
        <li key={m.id} data-from={m.fromAdmin ? "liminal-bloom" : "you"} className={`flex flex-col gap-1 rounded-lg border border-line-subtle p-4 ${m.fromAdmin ? "bg-line-subtle" : "bg-raised"}`}>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{m.fromAdmin ? "Liminal Bloom" : "You"}</span>
            <LocalTime at={m.createdAt} />
          </p>
          <p className="whitespace-pre-wrap text-ink wrap-break-word">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}
