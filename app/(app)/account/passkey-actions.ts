"use server";

// Passkeys on Account (spec 0.7.1 8.4, A3c): allow adding (the password), rename, remove (the password). Better
// Auth's browser routes for rename, remove and list are closed (lib/auth-closed-paths.ts), so these are the only
// way. The guard is requireAccountPerson, as for the two-step actions: a person whose role requires two-factor
// and who has none yet is exactly who adds a passkey, and requireMember would send them away.

import { headers } from "next/headers";

import { requireAccountPerson } from "@/lib/current-member";
import { allowPasskeyAdd, removePasskey, renamePasskey } from "@/lib/passkeys/change";
import { type PasskeyReply, passkeyRefused } from "@/lib/passkeys/replies";
import { MAX_PASSWORD } from "@/lib/password-limits";

const goodPassword = (x: unknown): x is string => typeof x === "string" && x !== "" && x.length <= MAX_PASSWORD;
const goodId = (x: unknown): x is string => typeof x === "string" && x !== "" && x.length <= 64;

const toReply = (reply: Awaited<ReturnType<typeof removePasskey>>): PasskeyReply => (reply.status === "ok" ? reply : passkeyRefused(reply.reason, reply.store));

export async function allowPasskeyAddAction(password: unknown): Promise<PasskeyReply> {
  const person = await requireAccountPerson();
  if (!goodPassword(password)) return passkeyRefused("password");
  return toReply(await allowPasskeyAdd(await headers(), person.user.id, password));
}

export async function renamePasskeyAction(id: unknown, name: unknown): Promise<PasskeyReply> {
  const person = await requireAccountPerson();
  if (!goodId(id) || typeof name !== "string") return passkeyRefused("missing");
  return toReply(await renamePasskey(person.user.id, id, name));
}

export async function removePasskeyAction(id: unknown, password: unknown): Promise<PasskeyReply> {
  const person = await requireAccountPerson();
  if (!goodId(id)) return passkeyRefused("missing");
  if (!goodPassword(password)) return passkeyRefused("password");
  return toReply(await removePasskey(await headers(), person.user.id, id, password));
}
