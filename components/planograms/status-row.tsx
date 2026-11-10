// The one status row above a planogram's grid (UX audit U20): the version
// line, Draft | Published, the due date, the save status and the actions.

"use client";

import { InfoPopover } from "@/components/ui/info-popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PublishedVersion } from "@/lib/planograms/queries";

import { DraftStatusLine } from "./draft-status";
import { DueDateChip } from "./due-date-chip";
import type { DraftStatus } from "./use-planogram-draft";
import { VersionLine } from "./version-line";

type StatusRowProps = {
  fixtureId: string;
  latest: PublishedVersion | null;
  hasDraft: boolean;
  view: "draft" | "published";
  onView: (view: "draft" | "published") => void;
  dueDate: string | null;
  today: string;
  /** Only while the draft is being edited. */
  status: DraftStatus | null;
  children: React.ReactNode;
};

export function StatusRow({ fixtureId, latest, hasDraft, view, onView, dueDate, today, status, children }: StatusRowProps) {
  return (
    <div data-status-row className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <VersionLine latest={latest} />
      {hasDraft ? (
        <span className="inline-flex max-w-full items-center gap-1">
          <SegmentedControl
            label="Show"
            options={[
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
            ]}
            value={view}
            onChange={onView}
          />
          <InfoPopover term="draft" />
        </span>
      ) : null}
      <DueDateChip fixtureId={fixtureId} dueDate={dueDate} today={today} />
      {status ? <DraftStatusLine status={status} /> : null}
      {children}
    </div>
  );
}
