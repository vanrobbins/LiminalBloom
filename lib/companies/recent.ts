// The latest changes to a company for /company's Recent changes (spec 0.7.1 6.2): the last 20 of its own
// company_events and, for the owner only (DECISIONS 11-11), the last 20 of Liminal Bloom's platform_events about
// it, merged newest first. The caller has already checked company.people; the platform rows additionally need
// `owner`. Liminal Bloom's lines carry the reason and never an admin's name.

import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { companyEvents, platformEvents } from "@/db/schema";
import type { CompanyAccess } from "@/lib/access/resolve-merge";

import { companyEventText, platformEventText } from "./events-text";

export const RECENT_LIMIT = 20;

export type RecentChange = { id: string; text: string; at: Date; liminal: boolean };

export async function recentChanges(company: CompanyAccess): Promise<RecentChange[]> {
  const [own, theirs] = await Promise.all([
    db.select().from(companyEvents).where(eq(companyEvents.companyId, company.id)).orderBy(desc(companyEvents.createdAt)).limit(RECENT_LIMIT),
    company.role === "owner"
      ? db.select().from(platformEvents).where(eq(platformEvents.companyId, company.id)).orderBy(desc(platformEvents.createdAt)).limit(RECENT_LIMIT)
      : Promise.resolve([]),
  ]);
  const rows: RecentChange[] = [
    ...own.map((e) => ({ id: e.id, text: companyEventText({ event: e.event, actorName: e.actorName, detail: e.detail }), at: e.createdAt, liminal: false })),
    ...theirs.map((e) => ({ id: e.id, text: platformEventText({ event: e.action, actorName: "Liminal Bloom", detail: e.detail, reason: e.reason }, company.name), at: e.createdAt, liminal: true })),
  ];
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, RECENT_LIMIT);
}
