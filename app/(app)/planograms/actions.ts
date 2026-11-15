"use server";

// Planogram actions (spec §4–5). Input is parsed here; the store comes from the
// session (CODESTYLE rule 8). Replies carry words the screen can show as-is.

import { z } from "zod";

import { requireSwitchForAction } from "@/lib/current-member";
import { productFits } from "@/lib/planograms/draft-sources";
import { previewPublish, publishDraft, restoreVersion, type Preview } from "@/lib/planograms/publish";
import { draftState } from "@/lib/planograms/queries";
import { restoreMessage } from "@/lib/planograms/restore";
import { changeInput, dueDateInput, summaryInput, versionInput } from "@/lib/planograms/schemas";
import type { DraftState, ProductFit } from "@/lib/planograms/types";
import { discardDraft, saveChange, setDueDate, startDraft } from "@/lib/planograms/write";
import { searchProducts } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

// "forbidden" is the role's own answer (the switch is missing), told apart from a "refused" change so the screen never
// mistakes it for a draft that went away. Its words are plain, ready to show.
export type DraftReply =
  | { status: "saved"; draft: DraftState; notice?: string; id?: string }
  | { status: "refused"; message: string; draft: DraftState | null }
  | { status: "forbidden"; message: string; draft: null };
export type DoneReply = { status: "saved"; message: string } | { status: "refused"; message: string } | { status: "forbidden"; message: string };

const CONFLICT = "Changed on another device";
const NOT_ALLOWED_DRAFT = "Your role can't change planogram drafts.";
const NOT_ALLOWED_PUBLISH = "Your role can't publish planograms.";
const RELOAD = "Couldn't save that. Reload and try again.";
const uuid = z.uuid();
const optionalVersion = versionInput.nullable();
const isId = (id: string) => uuid.safeParse(id).success;

export async function startDraftAction(fixtureId: string, expectedVersion: number | null): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT };
  const { activeStoreId } = check.member;
  if (!isId(fixtureId) || !optionalVersion.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD };
  const result = await startDraft(activeStoreId, fixtureId, expectedVersion);
  return result.status === "saved" ? { status: "saved", message: "Draft started" } : { status: "refused", message: CONFLICT };
}

/**
 * The builder's first change with no draft (Part 2 spec §4): start one and hand
 * it back in the same request. If another device started one first, theirs is
 * returned, so this device works in it rather than failing (Review Focus 3).
 */
export async function beginDraftAction(fixtureId: string, expectedVersion: number | null): Promise<DraftReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT, draft: null };
  const { activeStoreId } = check.member;
  if (!isId(fixtureId) || !optionalVersion.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD, draft: null };
  const result = await startDraft(activeStoreId, fixtureId, expectedVersion);
  const draft = await draftState(activeStoreId, fixtureId);
  if (draft) return { status: "saved", draft };
  return { status: "refused", message: result.status === "not-found" ? "This fixture is no longer on the map." : CONFLICT, draft: null };
}

export async function saveChangeAction(fixtureId: string, raw: unknown): Promise<DraftReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT, draft: null };
  const { activeStoreId } = check.member;
  const parsed = changeInput.safeParse(raw);
  if (!isId(fixtureId) || !parsed.success) return { status: "refused", message: RELOAD, draft: null };
  const result = await saveChange(activeStoreId, fixtureId, parsed.data);
  const draft = await draftState(activeStoreId, fixtureId);
  if (result.status === "saved" && draft) return { status: "saved", draft, ...(result.switchedToHung ? { notice: "Switched to hung" } : {}), ...(result.id ? { id: result.id } : {}) };
  return { status: "refused", message: result.status === "invalid" ? result.message : CONFLICT, draft };
}

export async function reloadDraftAction(fixtureId: string): Promise<DraftState | null> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return null;
  const { activeStoreId } = check.member;
  return isId(fixtureId) ? draftState(activeStoreId, fixtureId) : null;
}

export async function discardDraftAction(fixtureId: string, expectedVersion: number): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT };
  const { activeStoreId } = check.member;
  if (!isId(fixtureId) || !versionInput.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD };
  const result = await discardDraft(activeStoreId, fixtureId, expectedVersion);
  return result.status === "saved" ? { status: "saved", message: "Draft discarded" } : { status: "refused", message: CONFLICT };
}

export async function setDueDateAction(fixtureId: string, dueDate: string | null): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.publish");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_PUBLISH };
  const { activeStoreId } = check.member;
  const date = dueDateInput.safeParse(dueDate);
  if (!isId(fixtureId) || !date.success) return { status: "refused", message: "Choose a date." };
  const result = await setDueDate(activeStoreId, fixtureId, date.data);
  return result.status === "saved"
    ? { status: "saved", message: date.data ? "Due date saved" : "Due date cleared" }
    : { status: "refused", message: CONFLICT };
}

export async function previewPublishAction(fixtureId: string): Promise<Preview | null> {
  const check = await requireSwitchForAction("planograms.publish");
  if (check.status === "forbidden") return null;
  const { activeStoreId } = check.member;
  return isId(fixtureId) ? previewPublish(activeStoreId, fixtureId) : null;
}

export async function publishAction(fixtureId: string, expectedVersion: number, basedOnVersion: number | null, summary: string): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.publish");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_PUBLISH };
  const { activeStoreId, user } = check.member;
  const text = summaryInput.safeParse(summary);
  if (!isId(fixtureId) || !versionInput.safeParse(expectedVersion).success || !optionalVersion.safeParse(basedOnVersion).success || !text.success) {
    return { status: "refused", message: "Keep the summary under 200 characters." };
  }
  const result = await publishDraft(activeStoreId, fixtureId, expectedVersion, basedOnVersion, text.data, { id: user.id, name: user.name || user.email });
  switch (result.status) {
    case "saved":
      return { status: "saved", message: `Version ${result.number} published` };
    case "published-elsewhere":
      return { status: "refused", message: `Version ${result.number} was published while you were editing — review the changes` };
    case "draft-changed":
      return { status: "refused", message: "The draft changed on another device — review the changes" };
    case "invalid":
      return { status: "refused", message: result.message };
    case "not-found":
      return { status: "refused", message: "This fixture is no longer on the map." };
  }
}

export async function restoreAction(fixtureId: string, expectedVersion: number, number: number): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.publish");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_PUBLISH };
  const { activeStoreId } = check.member;
  if (!isId(fixtureId) || !versionInput.safeParse(expectedVersion).success || !versionInput.safeParse(number).success) {
    return { status: "refused", message: RELOAD };
  }
  const result = await restoreVersion(activeStoreId, fixtureId, expectedVersion, number);
  if (result.status === "saved") return { status: "saved", message: restoreMessage(number, result.skipped) };
  return { status: "refused", message: result.status === "conflict" ? CONFLICT : "That version no longer exists." };
}

/** The add form's product search: the library's own trigram search, with footprints. */
export async function pickerSearch(q: string): Promise<ProductFit[]> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return [];
  const { activeStoreId } = check.member;
  const input = searchInput.safeParse({ q });
  if (!input.success) return [];
  const rows = await searchProducts(activeStoreId, input.data, 12);
  const fits = await productFits(activeStoreId, rows.map((r) => r.id));
  return rows.flatMap((r) => fits.get(r.id) ?? []);
}
