// The one status row above a planogram's grid (UX audit U20), showing only what
// applies: "Draft · not published" before a first publish; Draft | Published once
// a draft sits beside a published version (its tooltip explains drafts and gives
// the version line); the version line alone with no draft; the due date chip only
// once a date is set; why a change was refused; and the corner bar
// (corner-bar.tsx: save indicator, Undo, Redo, +, Publish, Discard, ⋯).

"use client";

import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip } from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/glossary";
import type { PublishedVersion } from "@/lib/planograms/queries";

import { DraftStatusLine } from "./draft-status";
import { DueDateChip } from "./due-date-chip";
import type { DraftStatus } from "./use-planogram-draft";
import { useVersionText, VersionLine } from "./version-line";

type View = "draft" | "published";

type StatusRowProps = {
  fixtureId: string;
  latest: PublishedVersion | null;
  hasDraft: boolean;
  view: View;
  onView: (view: View) => void;
  dueDate: string | null;
  today: string;
  /** Setting the due date is publishing's: without it the chip only shows the date. */
  canSetDueDate: boolean;
  /** Only while the draft is being edited. */
  status: DraftStatus | null;
  children: React.ReactNode;
};

/** Draft | Published; its tooltip is the explanation of drafts and the latest version's line. */
function ViewToggle({ latest, view, onView }: { latest: PublishedVersion; view: View; onView: (view: View) => void }) {
  const version = useVersionText(latest);
  return (
    <Tooltip label={`${GLOSSARY.draft.text} ${version}.`}>
      <span className="inline-flex max-w-full">
        <SegmentedControl
          label="Show"
          options={[
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
          ]}
          value={view}
          onChange={onView}
        />
      </span>
    </Tooltip>
  );
}

export function StatusRow({ fixtureId, latest, hasDraft, view, onView, dueDate, today, canSetDueDate, status, children }: StatusRowProps) {
  // The corner bar is the first row on a phone and ends the row from tablet width: it sits there in the page too, so the
  // tab order follows what is seen at every size. (The bar's own `order-first` keeps the server's first paint right on a phone.)
  const isPhone = useMediaQuery(PHONE_QUERY);
  return (
    <div data-status-row className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {isPhone ? children : null}
      {!latest ? <p className="text-sm text-ink-muted">Draft · not published</p> : hasDraft ? <ViewToggle latest={latest} view={view} onView={onView} /> : <VersionLine latest={latest} />}
      <DueDateChip fixtureId={fixtureId} dueDate={dueDate} today={today} canEdit={canSetDueDate} />
      {status ? <DraftStatusLine status={status} /> : null}
      {isPhone ? null : children}
    </div>
  );
}
