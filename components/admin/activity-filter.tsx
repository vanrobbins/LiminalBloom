// The activity list's filter: one kind or all, sent as a GET so the filtered list has its own address.

import { ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { ACTIVITY_FILTER } from "@/lib/admin/event-kinds";

export function ActivityFilter({ kind }: { kind: string | undefined }) {
  return (
    <form action="/admin/activity" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1 sm:w-64">
        <label htmlFor="activity-kind" className="text-sm text-ink">
          Kind
        </label>
        <select id="activity-kind" name="kind" defaultValue={kind ?? ""} className={FIELD_CLASSES}>
          <option value="">Everything</option>
          {ACTIVITY_FILTER.map((k) => (
            <option key={k.action} value={k.action}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" className="self-start">
        <ListFilter aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Filter
      </Button>
    </form>
  );
}
