"use server";

// Setting up two-step sign-in for an admin (spec 0.7.1 8.3). Better Auth's browser routes for this are
// closed (lib/auth-closed-paths.ts), so these actions are the only way in, and only for an admin: the
// guard is requirePlatformAdminAccountForAction, which asks for an admin but not yet for a second factor
// (an admin without one is exactly who calls these; app/server-actions-guard.test.ts lists the reason).
// The work is in lib/two-factor/setup.ts; the confirm's new session cookie is carried to the browser here.

import { headers } from "next/headers";

import { requirePlatformAdminAccountForAction } from "@/lib/admin/guard";
import { applyAuthCookies } from "@/lib/auth-cookies";
import { type ConfirmActionReply, refused, type StartActionReply } from "@/lib/two-factor/replies";
import { confirmTwoFactor, startTwoFactor } from "@/lib/two-factor/setup";
import { MAX_PASSWORD } from "@/lib/password-limits";

const NOT_ALLOWED = refused("failed");

export async function startTwoFactorAction(password: unknown): Promise<StartActionReply> {
  const check = await requirePlatformAdminAccountForAction();
  if (check.status === "forbidden") return NOT_ALLOWED;
  if (typeof password !== "string" || password === "" || password.length > MAX_PASSWORD) return refused("password");
  const reply = await startTwoFactor(await headers(), check.admin.userId, password);
  return reply.status === "started" ? reply : refused(reply.reason);
}

export async function confirmTwoFactorAction(code: unknown): Promise<ConfirmActionReply> {
  const check = await requirePlatformAdminAccountForAction();
  if (check.status === "forbidden") return NOT_ALLOWED;
  if (typeof code !== "string" || code.trim() === "" || code.length > 32) return refused("code");
  const reply = await confirmTwoFactor(await headers(), check.admin.userId, code.trim());
  if (reply.status === "refused") return refused(reply.reason);
  // Better Auth swapped this person's session for a new one: its cookie has to reach the browser or
  // the person is signed out the moment two-factor turns on (`--reset-two-factor` is the way back).
  await applyAuthCookies(reply.responseHeaders);
  return { status: "on" };
}
