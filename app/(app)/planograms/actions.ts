"use server";

// Planogram actions (spec §4–5). Input is parsed here; the store comes from the
// session (CODESTYLE rule 8). Replies carry words the screen can show as-is.

import { z } from "zod";

import { requireMember } from "@/lib/current-member";
import { previewPublish, publishDraft, restoreVersion, type Preview } from "@/lib/planograms/publish";
import { draftState, productFits } from "@/lib/planograms/queries";
import { restoreMessage } from "@/lib/planograms/restore";
import { changeInput, dueDateInput, summaryInput, versionInput } from "@/lib/planograms/schemas";
import type { DraftState, ProductFit } from "@/lib/planograms/types";
import { discardDraft, saveChange, setDueDate, startDraft } from "@/lib/planograms/write";
import { searchProducts } from "@/lib/products/queries";
import { searchInput } from "@/lib/products/schemas";

export type DraftReply = { status: "saved"; draft: DraftState } | { status: "refused"; message: string; draft: DraftState | null };
export type DoneReply = { status: "saved"; message: string } | { status: "refused"; message: string };

const CONFLICT = "Changed on another device";
const RELOAD = "Couldn't save that. Reload and try again.";
const uuid = z.uuid();
const optionalVersion = versionInput.nullable();
const isId = (id: string) => uuid.safeParse(id).success;

export async function startDraftAction(fixtureId: string, expectedVersion: number | null): Promise<DoneReply> {
  const { activeStoreId } = await requireMember();
  if (!isId(fixtureId) || !optionalVersion.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD };
  const result = await startDraft(activeStoreId, fixtureId, expectedVersion);
  return result.status === "saved" ? { status: "saved", message: "Draft started" } : { status: "refused", message: CONFLICT };
}

export async function saveChangeAction(fixtureId: string, raw: unknown): Promise<DraftReply> {
  const { activeStoreId } = await requireMember();
  const parsed = changeInput.safeParse(raw);
  if (!isId(fixtureId) || !parsed.success) return { status: "refused", message: RELOAD, draft: null };
  const result = await saveChange(activeStoreId, fixtureId, parsed.data);
  const draft = await draftState(activeStoreId, fixtureId);
  if (result.status === "saved" && draft) return { status: "saved", draft };
  return { status: "refused", message: result.status === "invalid" ? result.message : CONFLICT, draft };
}

export async function reloadDraftAction(fixtureId: string): Promise<DraftState | null> {
  const { activeStoreId } = await requireMember();
  return isId(fixtureId) ? draftState(activeStoreId, fixtureId) : null;
}

export async function discardDraftAction(fixtureId: string, expectedVersion: number): Promise<DoneReply> {
  const { activeStoreId } = await requireMember();
  if (!isId(fixtureId) || !versionInput.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD };
  const result = await discardDraft(activeStoreId, fixtureId, expectedVersion);
  return result.status === "saved" ? { status: "saved", message: "Draft discarded" } : { status: "refused", message: CONFLICT };
}

export async function setDueDateAction(fixtureId: string, dueDate: string | null): Promise<DoneReply> {
  const { activeStoreId } = await requireMember();
  const date = dueDateInput.safeParse(dueDate);
  if (!isId(fixtureId) || !date.success) return { status: "refused", message: "Choose a date." };
  const result = await setDueDate(activeStoreId, fixtureId, date.data);
  return result.status === "saved"
    ? { status: "saved", message: date.data ? "Due date saved" : "Due date cleared" }
    : { status: "refused", message: CONFLICT };
}

export async function previewPublishAction(fixtureId: string): Promise<Preview | null> {
  const { activeStoreId } = await requireMember();
  return isId(fixtureId) ? previewPublish(activeStoreId, fixtureId) : null;
}

export async function publishAction(fixtureId: string, expectedVersion: number, basedOnVersion: number | null, summary: string): Promise<DoneReply> {
  const { activeStoreId, user } = await requireMember();
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
  const { activeStoreId } = await requireMember();
  if (!isId(fixtureId) || !versionInput.safeParse(expectedVersion).success || !versionInput.safeParse(number).success) {
    return { status: "refused", message: RELOAD };
  }
  const result = await restoreVersion(activeStoreId, fixtureId, expectedVersion, number);
  if (result.status === "saved") return { status: "saved", message: restoreMessage(number, result.skipped) };
  return { status: "refused", message: result.status === "conflict" ? CONFLICT : "That version no longer exists." };
}

/** The add form's product search: the library's own trigram search, with footprints. */
export async function pickerSearch(q: string): Promise<ProductFit[]> {
  const { activeStoreId } = await requireMember();
  const input = searchInput.safeParse({ q });
  if (!input.success) return [];
  const rows = await searchProducts(activeStoreId, input.data, 12);
  const fits = await productFits(activeStoreId, rows.map((r) => r.id));
  return rows.flatMap((r) => fits.get(r.id) ?? []);
}
