"use server";

// The admin step-up (spec 0.7.1 8.3): a fresh authenticator code for a session whose last one is
// missing or older than 12 hours. The guard is requirePlatformAdminAccountForAction: an admin, but
// not yet one with a fresh factor, since this is how they get it (app/server-actions-guard.test.ts
// lists the reason). The 5-per-10-minutes limit and `two_factor_at` are in lib/admin/step-up.ts.

import { headers } from "next/headers";

import { requirePlatformAdminAccountForAction } from "@/lib/admin/guard";
import { verifyAdminCode } from "@/lib/admin/step-up";
import { type VerifyActionReply, refused } from "@/lib/two-factor/replies";

export async function verifyAdminCodeAction(code: unknown): Promise<VerifyActionReply> {
  const check = await requirePlatformAdminAccountForAction();
  if (check.status === "forbidden") return refused("failed");
  if (!check.admin.twoFactorEnabled) return refused("not-on");
  if (typeof code !== "string" || code.trim() === "" || code.length > 32) return refused("code");
  const reply = await verifyAdminCode(await headers(), check.admin.userId, check.admin.sessionId, code.trim());
  return reply.status === "ok" ? reply : refused(reply.reason);
}
