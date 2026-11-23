"use server";

// Two-step sign-in for any account (spec 0.7.1 8.3, A3b): turn on, turn off, new backup codes. Better Auth's
// browser routes for these are closed (lib/auth-closed-paths.ts), so these actions are the only way in. The
// work is in lib/two-factor/; the new session cookie that turning it on or off makes is carried here.
// The guard is requireAccountPerson, not requireMember: a person whose role requires two-factor and who has
// none yet is exactly who calls these, and requireMember would send them away (app/server-actions-guard.test.ts).

import { headers } from "next/headers";

import { applyAuthCookies } from "@/lib/auth-cookies";
import { requireAccountPerson } from "@/lib/current-member";
import { MAX_PASSWORD } from "@/lib/password-limits";
import { disableTwoFactor } from "@/lib/two-factor/disable";
import { type CodesActionReply, type ConfirmActionReply, type DisableActionReply, refused, type StartActionReply } from "@/lib/two-factor/replies";
import { confirmTwoFactor, newBackupCodes, startTwoFactor } from "@/lib/two-factor/setup";

const goodPassword = (x: unknown): x is string => typeof x === "string" && x !== "" && x.length <= MAX_PASSWORD;
const goodCode = (x: unknown): x is string => typeof x === "string" && x.trim() !== "" && x.length <= 32;

export async function startTwoFactorAction(password: unknown): Promise<StartActionReply> {
  const person = await requireAccountPerson();
  if (!goodPassword(password)) return refused("password");
  const reply = await startTwoFactor(await headers(), person.user.id, password);
  return reply.status === "started" ? reply : refused(reply.reason);
}

export async function confirmTwoFactorAction(code: unknown): Promise<ConfirmActionReply> {
  const person = await requireAccountPerson();
  if (!goodCode(code)) return refused("code");
  const reply = await confirmTwoFactor(await headers(), person.user.id, code.trim());
  if (reply.status === "refused") return refused(reply.reason);
  // Better Auth swapped this person's session for a new one: its cookie must reach the browser or they are signed out.
  await applyAuthCookies(reply.responseHeaders);
  return { status: "on" };
}

export async function newBackupCodesAction(password: unknown): Promise<CodesActionReply> {
  const person = await requireAccountPerson();
  if (!goodPassword(password)) return refused("password");
  const reply = await newBackupCodes(await headers(), person.user.id, password);
  return reply.status === "codes" ? reply : refused(reply.reason);
}

export async function disableTwoFactorAction(password: unknown, code: unknown): Promise<DisableActionReply> {
  const person = await requireAccountPerson();
  if (!goodPassword(password)) return refused("password");
  if (!goodCode(code)) return refused("code");
  const reply = await disableTwoFactor(await headers(), person.user.id, password, code.trim());
  if (reply.status === "refused") return reply.reason === "required" && reply.store ? { status: "refused", message: `Your role in ${reply.store} requires two-factor sign-in.` } : refused(reply.reason);
  await applyAuthCookies(reply.responseHeaders);
  return { status: "off" };
}
