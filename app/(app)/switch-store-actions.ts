"use server";

// Switching the store a person works in (spec 0.7.1, 4.3). The one way to move `session.active_store_id`:
// Better Auth's own /organization/set-active is closed. Any signed-in person may switch, so there is no switch to
// hold, and the guard is requireAccountPerson: a person whose role in this store still needs two-factor may move to
// another of their stores (DECISIONS 11-23), and that store asks for its own requirement on the next request. The
// real check is in setActiveStore, which refuses a store the person does not reach today (a store of another
// company, a standalone store they are not in, a paused one, or any store when nothing resolves).

import { headers } from "next/headers";
import { z } from "zod";

import { setActiveStore, type SetActiveOutcome } from "@/lib/access/set-active-store";
import { auth } from "@/lib/auth";
import { requireAccountPerson } from "@/lib/current-member";

export async function switchStore(storeId: unknown): Promise<SetActiveOutcome> {
  const person = await requireAccountPerson();
  const id = z.string().min(1).max(200).safeParse(storeId);
  if (!id.success) return { status: "forbidden" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "forbidden" };
  return setActiveStore(session.session.id, person.user.id, id.data);
}
