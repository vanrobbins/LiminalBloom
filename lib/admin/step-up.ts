// The admin step-up: a fresh authenticator code for a session that has none or an old one (spec 0.7.1
// 8.3). With a session present, Better Auth's `verifyTOTP` counts no wrong codes and makes no session,
// no hook call and no cookie (A0, 8.4 item 2), so this counts them itself (5 per 10 minutes,
// lib/admin/two-factor-guesses.ts) and sets `two_factor_at` on the session with Drizzle.

import "server-only";

import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

import { clearWrongCodes, recordWrongCode, tooManyCodeGuesses } from "./two-factor-guesses";

export type StepUpReply = { status: "ok" } | { status: "refused"; reason: "code" | "locked" | "failed" };

/** Checks `code` for the account asking and, if right, marks `sessionId` (one of that account's sessions) as having passed it now. */
export async function verifyAdminCode(requestHeaders: Headers, userId: string, sessionId: string, code: string): Promise<StepUpReply> {
  if (await tooManyCodeGuesses(userId)) return { status: "refused", reason: "locked" };
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: requestHeaders });
  } catch (error) {
    if (error instanceof APIError && (error.body as { code?: string } | undefined)?.code === "INVALID_CODE") {
      await recordWrongCode(userId);
      return { status: "refused", reason: "code" };
    }
    return { status: "refused", reason: "failed" };
  }
  await clearWrongCodes(userId);
  await db
    .update(session)
    .set({ twoFactorAt: new Date() })
    .where(and(eq(session.id, sessionId), eq(session.userId, userId)));
  return { status: "ok" };
}
