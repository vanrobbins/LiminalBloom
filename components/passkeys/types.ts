// The passkey server actions as props (each page passes the ones with its own guard), and what a row shows.

import type { PasskeyReply } from "@/lib/passkeys/replies";

export type PasskeyActions = {
  /** Checks the password and lets the person register one passkey in the next five minutes. */
  allow: (password: string) => Promise<PasskeyReply>;
  rename: (id: string, name: string) => Promise<PasskeyReply>;
  remove: (id: string, password: string) => Promise<PasskeyReply>;
};

/** A passkey as the browser gets it: dates are serialized by Next, so they arrive as Dates. */
export type PasskeyItem = { id: string; name: string | null; createdAt: Date | null; lastUsedAt: Date | null };
