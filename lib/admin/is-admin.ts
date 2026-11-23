// Whether an account is a Liminal Bloom admin: one read of `platform_admins`. For the avatar menu and the
// palette, which show a link to /admin and nothing else. It authorises nothing: /admin re-reads it through
// lib/admin/guard.ts on every request (spec 0.7.1 13).

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformAdmins } from "@/db/schema";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: platformAdmins.userId }).from(platformAdmins).where(eq(platformAdmins.userId, userId));
  return row !== undefined;
}
