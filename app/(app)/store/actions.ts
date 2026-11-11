"use server";

// Store settings (DECISIONS "Time", 10-12). The store comes from the session
// (CODESTYLE rule 8); who may change it is the store.settings switch, checked here
// and again against the database in lib/store-settings.ts.

import { z } from "zod";

import { requireSwitchForAction } from "@/lib/current-member";
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
