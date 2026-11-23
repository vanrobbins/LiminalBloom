// What the Account page shows about the signed-in person's two-factor: whether it is on, how many backup
// codes are left (the count only: the codes themselves never leave the server here), and whether the
// account is a Liminal Bloom admin, who can't turn it off, or holds a role that
// requires it (the store's name, for the line that says so).

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { auth } from "@/lib/auth";

import { hasSecondFactor } from "./has-second-factor";
import { storeRequiringTwoFactor } from "./required-by";

export type TwoFactorStatus = { on: boolean; codesLeft: number; isAdmin: boolean; requiredBy: string | null };

export async function twoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const [on, admin, requiredBy] = await Promise.all([
    hasSecondFactor(userId),
    db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId)),
    storeRequiringTwoFactor(userId),
  ]);
  let codesLeft = 0;
  if (on) {
    // Server-only endpoint (no browser route). A failure shows "unknown" as 0 rather than breaking Account.
    codesLeft = await auth.api
      .viewBackupCodes({ body: { userId } })
      .then((r) => r.backupCodes.length)
      .catch(() => 0);
  }
  return { on, codesLeft, isAdmin: admin.length > 0, requiredBy };
}
