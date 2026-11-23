// What a `platform_events` action is called on the admin screens (spec 0.7.1 7.5). Pure, so the
// overview, the activity list and its filter share one list. An action this file does not know is
// shown as written: a new kind is never hidden.

export type EventKind = { action: string; label: string };

// 0.7.1a writes these. `two_factor_reset` is the script's (scripts/platform-admin-run.ts).
const PART_A: EventKind[] = [
  { action: "admin_added", label: "Admin added" },
  { action: "admin_removed", label: "Admin removed" },
  { action: "signed_out_everywhere", label: "Signed out everywhere" },
  { action: "invitation_canceled", label: "Invitation canceled" },
  { action: "store_manager_made", label: "Store Manager made" },
  { action: "store_paused", label: "Store paused" },
  { action: "store_restored", label: "Store restored" },
  { action: "two_factor_reset", label: "Two-step sign-in reset" },
  { action: "help_closed", label: "Help request closed" },
];

// 0.7.1b's, so the list reads the same once they exist; the filter offers them then.
const PART_B: EventKind[] = [
  { action: "company_paused", label: "Company paused" },
  { action: "company_restored", label: "Company restored" },
  { action: "ownership_handed_off", label: "Ownership handed off" },
  { action: "company_approved", label: "Company approved" },
  { action: "company_rejected", label: "Company rejected" },
];

/** The kinds the activity filter offers. */
export const ACTIVITY_FILTER: readonly EventKind[] = PART_A;

const LABELS = new Map([...PART_A, ...PART_B].map((k) => [k.action, k.label]));

export const eventLabel = (action: string): string => LABELS.get(action) ?? action;

/** Whether a value from the URL is a kind the filter offers. */
export const isEventKind = (value: string | undefined): value is string => value !== undefined && ACTIVITY_FILTER.some((k) => k.action === value);
