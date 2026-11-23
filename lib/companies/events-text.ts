// Recent changes in words (spec 0.7.1 6.2). Pure: the company's own events read "Ana added the region North";
// Liminal Bloom's read "Liminal Bloom paused Acme: reason" and never name an admin (DECISIONS 11-11).

export type EventRow = { event: string; actorName: string; detail: Record<string, unknown>; reason?: string };

const str = (v: unknown, fallback: string) => (typeof v === "string" && v !== "" ? v : fallback);

/** One company event as a sentence without a date. */
export function companyEventText({ event, actorName, detail }: EventRow): string {
  switch (event) {
    case "company_renamed":
      return `${actorName} renamed the company from ${str(detail.from, "its old name")} to ${str(detail.to, "a new name")}`;
    case "region_added":
      return `${actorName} added the region ${str(detail.name, "a region")}`;
    case "region_renamed":
      return `${actorName} renamed the region ${str(detail.from, "a region")} to ${str(detail.to, "a new name")}`;
    case "region_deleted":
      return `${actorName} deleted the region ${str(detail.name, "a region")}`;
    case "store_added":
      return `${actorName} added ${str(detail.store, "a store")} to ${str(detail.region, "No region")}`;
    case "store_moved":
      return `${actorName} moved ${str(detail.store, "a store")} from ${str(detail.from, "No region")} to ${str(detail.to, "No region")}`;
    default:
      return `${actorName} made a change`;
  }
}

/** One of Liminal Bloom's own events about the company (platform_events), shown to the owner. */
export function platformEventText({ event, reason }: EventRow, company: string): string {
  const why = reason ? `: ${reason}` : "";
  switch (event) {
    case "company_paused":
      return `Liminal Bloom paused ${company}${why}`;
    case "company_restored":
      return `Liminal Bloom restored ${company}${why}`;
    case "ownership_handed_off":
      return `Liminal Bloom handed ownership of ${company} to another person${why}`;
    case "company_approved":
      return `Liminal Bloom approved ${company}`;
    case "company_rejected":
      return `Liminal Bloom turned down the request for ${company}${why}`;
    default:
      return `Liminal Bloom made a change to ${company}${why}`;
  }
}
