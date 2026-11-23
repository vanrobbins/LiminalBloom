"use server";

// New backup codes for an admin who has two-step sign-in on. A full admin guard (two-factor on and a
// code entered inside 12 hours), then the password again (lib/two-factor/setup.ts).

import { headers } from "next/headers";

import { requirePlatformAdminForAction } from "@/lib/admin/guard";
import { MAX_PASSWORD } from "@/lib/password-limits";
import { type CodesActionReply, refused } from "@/lib/two-factor/replies";
import { newBackupCodes } from "@/lib/two-factor/setup";

export async function newBackupCodesAction(password: unknown): Promise<CodesActionReply> {
  const check = await requirePlatformAdminForAction();
  if (check.status === "forbidden") return refused("failed");
  if (typeof password !== "string" || password === "" || password.length > MAX_PASSWORD) return refused("password");
  const reply = await newBackupCodes(await headers(), check.admin.userId, password);
  return reply.status === "codes" ? reply : refused(reply.reason);
}
