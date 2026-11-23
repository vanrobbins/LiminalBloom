"use server";

// Switching the store a person works in (spec 0.7.1, 4.3). The one way to move `session.active_store_id`:
// Better Auth's own /organization/set-active is closed. Any member may switch, so the guard asks only for
// `view`, which every role holds; the real check is in setActiveStore, which refuses a store the person
// does not reach today (a store of another company, a standalone store they are not in, a paused one).

import { headers } from "next/headers";
import { z } from "zod";

import { setActiveStore, type SetActiveOutcome } from "@/lib/access/set-active-store";
import { auth } from "@/lib/auth";
import { requireSwitchForAction } from "@/lib/current-member";

export async function switchStore(storeId: unknown): Promise<SetActiveOutcome> {
  const check = await requireSwitchForAction("view");
  if (check.status === "forbidden") return { status: "forbidden" };
  const id = z.string().min(1).max(200).safeParse(storeId);
  if (!id.success) return { status: "forbidden" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "forbidden" };
  return setActiveStore(session.session.id, check.member.user.id, id.data);
}
