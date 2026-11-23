"use server";

// /company's writes (spec 0.7.1 6.2, 6.3): the company's name, its regions, and where a store sits. Who may is a
// company switch (company.settings, company.structure), checked here from the session; the company id is the
// person's own, never the browser's, so nothing here can reach another company. Adding a store is in
// store-actions.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCompanyForAction } from "@/lib/companies/guard";
import { renameCompany } from "@/lib/companies/rename";
import { addRegion, deleteRegion, moveStore, renameRegion, type RegionOutcome } from "@/lib/companies/structure-write";

export type CompanyReply = { status: "saved" | "refused"; message: string };

const NOT_SETTINGS = "Your role can't change the company's settings.";
const NOT_STRUCTURE = "Your role can't change the company's structure.";
const NAME_LENGTH = "Give the company a name of 2 to 60 characters.";
const REGION_LENGTH = "Give the region a name of 1 to 40 characters.";
const GONE = "That is out of date. Reload the page and try again.";
const text = z.string().max(500);
const id = z.string().min(1).max(200);

export async function renameCompanyAction(name: unknown, seenName: unknown): Promise<CompanyReply> {
  const check = await requireCompanyForAction("company.settings");
  if (check.status === "forbidden") return { status: "refused", message: NOT_SETTINGS };
  const { user, company } = check.person;
  const parsed = z.tuple([text, text]).safeParse([name, seenName]);
  if (!parsed.success) return { status: "refused", message: NAME_LENGTH };
  const outcome = await renameCompany(company.id, { userId: user.id, name: user.name }, parsed.data[1], parsed.data[0]);
  switch (outcome.status) {
    case "renamed":
      // The store switcher names the company.
      revalidatePath("/", "layout");
      return { status: "saved", message: "Company name saved" };
    case "unchanged":
      return { status: "saved", message: "Company name saved" };
    case "invalid":
      return { status: "refused", message: NAME_LENGTH };
    case "stale":
      return { status: "refused", message: "Changed on another device" };
  }
}

function regionReply(outcome: RegionOutcome, name: string): CompanyReply {
  switch (outcome.status) {
    case "added":
    case "renamed":
    case "deleted":
    case "unchanged":
      return { status: "saved", message: "Saved" };
    case "invalid":
      return { status: "refused", message: REGION_LENGTH };
    case "taken":
      return { status: "refused", message: `There is already a region called ${name}.` };
    case "used":
      return { status: "refused", message: "Move this region's stores and regional managers first." };
    case "stale":
    case "gone":
      return { status: "refused", message: GONE };
  }
}

export async function addRegionAction(name: unknown): Promise<CompanyReply> {
  const check = await requireCompanyForAction("company.structure");
  if (check.status === "forbidden") return { status: "refused", message: NOT_STRUCTURE };
  const { user, company } = check.person;
  const parsed = text.safeParse(name);
  if (!parsed.success) return { status: "refused", message: REGION_LENGTH };
  return regionReply(await addRegion(company.id, { userId: user.id, name: user.name }, parsed.data), parsed.data.trim());
}

export async function renameRegionAction(regionId: unknown, name: unknown, seenName: unknown, seenVersion: unknown): Promise<CompanyReply> {
  const check = await requireCompanyForAction("company.structure");
  if (check.status === "forbidden") return { status: "refused", message: NOT_STRUCTURE };
  const { user, company } = check.person;
  const parsed = z.tuple([id, text, text, z.number().int().min(0).max(2_000_000_000)]).safeParse([regionId, name, seenName, seenVersion]);
  if (!parsed.success) return { status: "refused", message: REGION_LENGTH };
  const [region, to, seenNameText, version] = parsed.data;
  return regionReply(await renameRegion(company.id, { userId: user.id, name: user.name }, region, { name: seenNameText, version }, to), to.trim());
}

export async function deleteRegionAction(regionId: unknown): Promise<CompanyReply> {
  const check = await requireCompanyForAction("company.structure");
  if (check.status === "forbidden") return { status: "refused", message: NOT_STRUCTURE };
  const { user, company } = check.person;
  const parsed = id.safeParse(regionId);
  if (!parsed.success) return { status: "refused", message: GONE };
  return regionReply(await deleteRegion(company.id, { userId: user.id, name: user.name }, parsed.data), "");
}

/** `regionId` null puts the store in "No region". */
export async function moveStoreAction(storeId: unknown, regionId: unknown): Promise<CompanyReply> {
  const check = await requireCompanyForAction("company.structure");
  if (check.status === "forbidden") return { status: "refused", message: NOT_STRUCTURE };
  const { user, company } = check.person;
  const parsed = z.tuple([id, id.nullable()]).safeParse([storeId, regionId]);
  if (!parsed.success) return { status: "refused", message: GONE };
  const outcome = await moveStore(company.id, { userId: user.id, name: user.name }, parsed.data[0], parsed.data[1]);
  if (outcome.status === "gone") return { status: "refused", message: GONE };
  // The switcher groups stores by region.
  revalidatePath("/", "layout");
  return { status: "saved", message: "Store moved" };
}
