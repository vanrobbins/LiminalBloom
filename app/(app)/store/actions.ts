"use server";

// Store settings (DECISIONS "Time", 10-12). The store comes from the session
// (CODESTYLE rule 8); who may change it is the store.settings switch, checked here
// and again against the database in lib/store-settings.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSwitchForAction } from "@/lib/current-member";
import { renameStore } from "@/lib/store-name";
import { setStoreTimezone } from "@/lib/store-settings";

export type SettingsReply = { status: "saved" | "refused"; message: string };

const PICK = "Choose a time zone from the list.";
const NOT_ALLOWED = "Your role can't change store settings.";

export async function saveTimezoneAction(timezone: unknown, expectedVersion: unknown): Promise<SettingsReply> {
  const check = await requireSwitchForAction("store.settings");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, activeStoreId } = check.member;
  const zone = z.string().safeParse(timezone);
  // 0 = the store has no settings row yet (lib/store-settings.ts makes it).
  const version = z.int().min(0).safeParse(expectedVersion);
  if (!zone.success || !version.success) return { status: "refused", message: PICK };
  const outcome = await setStoreTimezone(activeStoreId, user.id, zone.data, version.data);
  switch (outcome.status) {
    case "saved":
      return { status: "saved", message: "Time zone saved" };
    case "invalid":
      return { status: "refused", message: PICK };
    case "forbidden":
      return { status: "refused", message: NOT_ALLOWED };
    case "conflict":
      return { status: "refused", message: "Changed on another device" };
  }
}

const NAME_LENGTH = "Give the store a name of 2 to 60 characters.";

// Pinned to the name the page showed (lib/store-name.ts), so a rename made on another
// device is reported, never overwritten.
export async function renameStoreAction(name: unknown, seenName: unknown): Promise<SettingsReply> {
  const check = await requireSwitchForAction("store.settings");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, activeStoreId } = check.member;
  const parsed = z.tuple([z.string().max(500), z.string().max(500)]).safeParse([name, seenName]);
  if (!parsed.success) return { status: "refused", message: NAME_LENGTH };
  const outcome = await renameStore(activeStoreId, { userId: user.id, name: user.name }, parsed.data[1], parsed.data[0]);
  switch (outcome.status) {
    case "renamed":
      // The store switcher and the header read the name in the layout.
      revalidatePath("/", "layout");
      return { status: "saved", message: "Store name saved" };
    case "unchanged":
      return { status: "saved", message: "Store name saved" };
    case "invalid":
      return { status: "refused", message: NAME_LENGTH };
    case "stale":
      return { status: "refused", message: "Changed on another device" };
  }
}
