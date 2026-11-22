"use server";

// Quick Adjust actions (0.7.0.9 spec §6.3). Input is parsed here; the store comes from the session (CODESTYLE rule 8).
// Drafting needs planograms.draft, publishing and reverting planograms.publish, Compare only view. Replies carry words the
// screen can show as-is, and a write hands back the whole draft (co-editing precedent).

import { z } from "zod";

import { requireSwitchForAction } from "@/lib/current-member";
import type { AdjustmentState } from "@/lib/planograms/adjust";
import { publishAdjustment, revertAdjustment } from "@/lib/planograms/adjust-publish";
import { draftOf, previewAdjustment, suggestionsFor, type AdjustPreview, type SuggestionView } from "@/lib/planograms/adjust-reads";
import { changeVersionInput, choiceInput, targetInput } from "@/lib/planograms/adjust-schemas";
import { discardAdjustment, openAdjustment, setChange } from "@/lib/planograms/adjust-write";
import { versionInput } from "@/lib/planograms/schemas";

import type { DoneReply } from "./actions";

export type AdjustReply =
  | { status: "saved"; draft: AdjustmentState }
  | { status: "refused"; message: string; draft: AdjustmentState | null }
  | { status: "forbidden"; message: string; draft: null };

const CONFLICT = "Changed on another device";
const NOT_ALLOWED_DRAFT = "Your role can't change Quick Adjusts.";
const NOT_ALLOWED_PUBLISH = "Your role can't publish Quick Adjusts.";
const RELOAD = "Couldn't save that. Reload and try again.";
const GONE = "This fixture is no longer on the map.";
const isId = (id: string) => z.uuid().safeParse(id).success;

export async function openAdjustmentAction(fixtureId: string): Promise<AdjustReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT, draft: null };
  const { activeStoreId, user } = check.member;
  if (!isId(fixtureId)) return { status: "refused", message: RELOAD, draft: null };
  const result = await openAdjustment(activeStoreId, fixtureId, user.name || user.email);
  if (result.status === "saved") return { status: "saved", draft: result.draft };
  return { status: "refused", message: result.status === "not-found" ? "Publish a version before adjusting it." : CONFLICT, draft: null };
}

export async function setChangeAction(fixtureId: string, adjustmentId: string, target: unknown, choice: unknown, expectedVersion: number | null): Promise<AdjustReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT, draft: null };
  const { activeStoreId } = check.member;
  const ref = targetInput.safeParse(target);
  const pick = choiceInput.safeParse(choice);
  const version = changeVersionInput.safeParse(expectedVersion);
  if (!isId(fixtureId) || !isId(adjustmentId) || !ref.success || !pick.success || !version.success) return { status: "refused", message: RELOAD, draft: null };
  const result = await setChange(activeStoreId, fixtureId, adjustmentId, ref.data, pick.data, version.data);
  const draft = await draftOf(activeStoreId, fixtureId);
  if (result.status === "saved" && draft) return { status: "saved", draft };
  return { status: "refused", message: result.status === "invalid" ? result.message : result.status === "not-found" ? GONE : CONFLICT, draft };
}

export async function suggestionsForAction(fixtureId: string, target: unknown): Promise<SuggestionView[]> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return [];
  const { activeStoreId } = check.member;
  const ref = targetInput.safeParse(target);
  return isId(fixtureId) && ref.success ? ((await suggestionsFor(activeStoreId, fixtureId, ref.data)) ?? []) : [];
}

export async function previewAdjustmentAction(fixtureId: string): Promise<AdjustPreview | null> {
  const check = await requireSwitchForAction("view");
  if (check.status === "forbidden") return null;
  const { activeStoreId } = check.member;
  return isId(fixtureId) ? previewAdjustment(activeStoreId, fixtureId) : null;
}

export async function publishAdjustmentAction(fixtureId: string, adjustmentId: string, expectedVersion: number): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.publish");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_PUBLISH };
  const { activeStoreId, user } = check.member;
  if (!isId(fixtureId) || !isId(adjustmentId) || !versionInput.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD };
  const result = await publishAdjustment(activeStoreId, fixtureId, adjustmentId, expectedVersion, { id: user.id, name: user.name || user.email });
  switch (result.status) {
    case "saved":
      return { status: "saved", message: "Quick Adjust published" };
    case "published-elsewhere":
      return { status: "refused", message: `Version ${result.number} was published meanwhile. This Quick Adjust ended with it.` };
    case "draft-changed":
      return { status: "refused", message: "Changed on another device. Look again before publishing." };
    case "invalid":
      return { status: "refused", message: result.message };
    case "not-found":
      return { status: "refused", message: GONE };
  }
}

export async function revertAdjustmentAction(fixtureId: string, adjustmentId: string): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.publish");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_PUBLISH };
  const { activeStoreId } = check.member;
  if (!isId(fixtureId) || !isId(adjustmentId)) return { status: "refused", message: RELOAD };
  const result = await revertAdjustment(activeStoreId, fixtureId, adjustmentId);
  if (result.status === "saved") return { status: "saved", message: "Quick Adjust reverted" };
  return { status: "refused", message: result.status === "not-found" ? GONE : "This Quick Adjust is no longer on the floor." };
}

export async function discardAdjustmentAction(fixtureId: string, adjustmentId: string, expectedVersion: number): Promise<DoneReply> {
  const check = await requireSwitchForAction("planograms.draft");
  if (check.status === "forbidden") return { status: "forbidden", message: NOT_ALLOWED_DRAFT };
  const { activeStoreId } = check.member;
  if (!isId(fixtureId) || !isId(adjustmentId) || !versionInput.safeParse(expectedVersion).success) return { status: "refused", message: RELOAD };
  const result = await discardAdjustment(activeStoreId, fixtureId, adjustmentId, expectedVersion);
  if (result.status === "saved") return { status: "saved", message: "Quick Adjust discarded" };
  return { status: "refused", message: result.status === "not-found" ? GONE : CONFLICT };
}
