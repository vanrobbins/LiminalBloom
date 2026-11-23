// What the Account page shows about the signed-in person's two-factor: whether the authenticator app is
// on, how many backup codes are left (the count only: the codes themselves never leave the server here),
// their passkeys, and whether the account is a Liminal Bloom admin or holds a role that requires it (the
// store's name, for the line that says so): those two keep a second factor, which a passkey also is.

import "server-only";

import { auth } from "@/lib/auth";
import { listPasskeys, type PasskeyRow } from "@/lib/passkeys/list";

import { hasAuthenticatorApp } from "./has-second-factor";
import { twoFactorRequirement } from "./required-by";

// `on` is the authenticator app only; the passkeys are listed beside it (a passkey is its own second factor).
export type TwoFactorStatus = { on: boolean; codesLeft: number; isAdmin: boolean; requiredBy: string | null; passkeys: PasskeyRow[] };

export async function twoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const [on, need, passkeys] = await Promise.all([hasAuthenticatorApp(userId), twoFactorRequirement(userId), listPasskeys(userId)]);
  let codesLeft = 0;
  if (on) {
    // Server-only endpoint (no browser route). A failure shows "unknown" as 0 rather than breaking Account.
    codesLeft = await auth.api
      .viewBackupCodes({ body: { userId } })
      .then((r) => r.backupCodes.length)
      .catch(() => 0);
  }
  return { on, codesLeft, isAdmin: need.isAdmin, requiredBy: need.store, passkeys };
}
