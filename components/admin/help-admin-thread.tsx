// An admin's view of one thread, oldest first (spec 0.7.1 9.2): who wrote each message (the admin's name shows
// here, to admins only; the requester sees "Liminal Bloom"), with the Context card beside it. Plain text only.

import { LocalTime } from "@/components/time/local-time";
import { Card } from "@/components/ui/card";
import { contextLines } from "@/lib/admin/help-context";
import type { AdminHelpMessage } from "@/lib/admin/help-reads";

export function AdminHelpThread({ messages }: { messages: AdminHelpMessage[] }) {
  return (
    <ul aria-label="Messages" className="flex flex-col gap-3">
      {messages.map((m) => (
        <li key={m.id} data-from={m.fromAdmin ? "liminal-bloom" : "requester"} className={`flex flex-col gap-1 rounded-lg border border-line-subtle p-4 ${m.fromAdmin ? "bg-line-subtle" : "bg-raised"}`}>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{m.authorName}</span>
            {m.fromAdmin ? <span>sent as Liminal Bloom</span> : null}
            <LocalTime at={m.createdAt} />
          </p>
          <p className="whitespace-pre-wrap text-ink wrap-break-word">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function HelpContextCard({ name, email, context }: { name: string; email: string; context: Record<string, unknown> }) {
  const lines = [{ label: "Name", value: name }, { label: "Email", value: email }, ...contextLines(context)];
  return (
    <Card compact>
      <h2 className="text-lg font-semibold text-ink">Context</h2>
      <dl className="mt-3 flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.label} className="flex flex-col gap-0.5">
            <dt className="text-sm text-ink-muted">{l.label}</dt>
            <dd className="text-ink wrap-break-word">{l.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
