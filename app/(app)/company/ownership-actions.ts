"use server";

// Handing ownership of the company to a corporate admin (spec 0.7.1 5.5). company.people from the session, then the
// owner check: ownership is a fact on the company, not a switch, so a corporate admin who holds the switch is still
// refused. The write (lib/companies/handoff.ts) is pinned to the company version and to the person still being a
// corporate admin.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompanyForAction } from "@/lib/companies/guard";
import { handOffOwnership } from "@/lib/companies/handoff";

export type HandOffReply = { status: "handed"; name: string } | { status: "refused"; message: string };

export async function handOffOwnershipAction(toUserId: unknown, seenVersion: unknown): Promise<HandOffReply> {
  const check = await requireCompanyForAction("company.people");
  if (check.status === "forbidden" || check.person.company.role !== "owner") return { status: "refused", message: "Only the owner can hand off ownership." };
  const { user, company } = check.person;
  const parsed = z.tuple([z.string().min(1).max(200), z.number().int().min(0).max(2_000_000_000)]).safeParse([toUserId, seenVersion]);
  if (!parsed.success) return { status: "refused", message: "That is out of date. Reload the page and try again." };
  const out = await handOffOwnership(company.id, { userId: user.id, name: user.name }, parsed.data[0], parsed.data[1]);
  switch (out.status) {
    case "handed":
      // The switcher and the menu name the company role.
      revalidatePath("/", "layout");
      return { status: "handed", name: out.name };
    case "forbidden":
      return { status: "refused", message: "Only the owner can hand off ownership." };
    case "gone":
      return { status: "refused", message: "That person is no longer a corporate admin. Reload the page and choose again." };
    case "stale":
      return { status: "refused", message: "The company changed while you were choosing. Reload the page and try again." };
  }
}
