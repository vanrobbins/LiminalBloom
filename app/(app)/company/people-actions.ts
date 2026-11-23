"use server";

// /company's people writes (spec 0.7.1 6.5): invite into a company role, cancel an invitation, change a regional
// manager's region, remove a company role. company.people from the session; the company and the actor (with their
// own company role) are the person's own, never the browser's, and every write re-checks the rank rule in its own
// statement (lib/companies). Hand-off is in ownership-actions.ts.

import { z } from "zod";

import { requireCompanyForAction } from "@/lib/companies/guard";
import { cancelCompanyInvitation, createCompanyInvitation, MAX_COMPANY_INVITATIONS, type CompanyInviteOutcome } from "@/lib/companies/invite";
import { changeRegion, removeCompanyPerson, type PersonOutcome } from "@/lib/companies/people-write";

export type PeopleReply = { status: "saved"; message: string } | { status: "refused"; message: string };
export type InviteReply = { status: "created"; id: string; email: string; expiresAt: string } | { status: "refused"; message: string };

const NOT_ALLOWED = "Your role can't change the company's people.";
const GONE = "That is out of date. Reload the page and try again.";
const id = z.string().min(1).max(200);
const version = z.number().int().min(0).max(2_000_000_000);

const inviteRefusal = (out: Exclude<CompanyInviteOutcome, { status: "created" }>): string => {
  switch (out.status) {
    case "bad-email":
      return "Enter a valid email address.";
    case "forbidden":
      return "You can only invite into a role below your own.";
    case "invalid":
      return "Choose a role, and a region for a regional manager.";
    case "already-member":
      return `${out.name} already has a role in this company.`;
    case "already-invited":
      return "That address already has an invitation waiting. Cancel it first to send a new one.";
    case "invitations-full":
      return `The company has ${MAX_COMPANY_INVITATIONS} invitations waiting, the most it can hold. Cancel one first.`;
  }
};

export async function inviteCompanyPersonAction(email: unknown, role: unknown, regionId: unknown): Promise<InviteReply> {
  const check = await requireCompanyForAction("company.people");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, company } = check.person;
  const parsed = z.tuple([z.string().max(254), z.string().max(40), id.nullable()]).safeParse([email, role, regionId]);
  if (!parsed.success) return { status: "refused", message: inviteRefusal({ status: "invalid" }) };
  const out = await createCompanyInvitation(company.id, { userId: user.id, name: user.name, role: company.role }, ...parsed.data);
  if (out.status !== "created") return { status: "refused", message: inviteRefusal(out) };
  return { status: "created", id: out.id, email: out.email, expiresAt: out.expiresAt.toISOString() };
}

export async function cancelCompanyInvitationAction(invitationId: unknown): Promise<PeopleReply> {
  const check = await requireCompanyForAction("company.people");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, company } = check.person;
  const parsed = id.safeParse(invitationId);
  if (!parsed.success) return { status: "refused", message: GONE };
  const out = await cancelCompanyInvitation(company.id, { userId: user.id, name: user.name, role: company.role }, parsed.data);
  if (out.status === "forbidden") return { status: "refused", message: "You can only cancel an invitation into a role below your own." };
  return out.status === "cancelled" ? { status: "saved", message: "Invitation cancelled" } : { status: "refused", message: GONE };
}

const personReply = (out: PersonOutcome): PeopleReply => {
  switch (out.status) {
    case "changed":
    case "removed":
      return { status: "saved", message: "Saved" };
    case "unchanged":
      return { status: "saved", message: "Saved" };
    case "forbidden":
      return { status: "refused", message: "You can only change people in a role below your own." };
    case "invalid":
      return { status: "refused", message: "Only a regional manager has a region." };
    case "stale":
    case "gone":
      return { status: "refused", message: GONE };
  }
};

/** `seenVersion` is the assignment's version the page showed, so a change made elsewhere meanwhile is refused. */
export async function changeRegionAction(userId: unknown, regionId: unknown, seenVersion: unknown): Promise<PeopleReply> {
  const check = await requireCompanyForAction("company.people");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, company } = check.person;
  const parsed = z.tuple([id, id, version]).safeParse([userId, regionId, seenVersion]);
  if (!parsed.success) return { status: "refused", message: GONE };
  return personReply(await changeRegion(company.id, { userId: user.id, name: user.name, role: company.role }, parsed.data[0], parsed.data[2], parsed.data[1]));
}

export async function removeCompanyPersonAction(userId: unknown, seenVersion: unknown): Promise<PeopleReply> {
  const check = await requireCompanyForAction("company.people");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, company } = check.person;
  const parsed = z.tuple([id, version]).safeParse([userId, seenVersion]);
  if (!parsed.success) return { status: "refused", message: GONE };
  return personReply(await removeCompanyPerson(company.id, { userId: user.id, name: user.name, role: company.role }, parsed.data[0], parsed.data[1]));
}
