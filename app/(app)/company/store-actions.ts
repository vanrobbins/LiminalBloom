"use server";

// Adding a store to the company (spec 0.7.1 6.4). company.structure, from the session: the company is the
// person's own. The work is lib/companies/store-add.ts; this makes the store through Better Auth with the
// request's headers (its own checks apply) and then makes it the store this session works in.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { setActiveStore } from "@/lib/access/set-active-store";
import { auth } from "@/lib/auth";
import { requireCompanyForAction } from "@/lib/companies/guard";
import { addCompanyStore } from "@/lib/companies/store-add";

/** `activeSet` is false when the store exists but this session could not be moved into it: the page stays put. */
export type AddStoreReply = { status: "added"; storeId: string; activeSet: boolean } | { status: "refused"; message: string };

const NOT_ALLOWED = "Your role can't change the company's structure.";

export async function addStoreAction(name: unknown, timezone: unknown, regionId: unknown): Promise<AddStoreReply> {
  const check = await requireCompanyForAction("company.structure");
  if (check.status === "forbidden") return { status: "refused", message: NOT_ALLOWED };
  const { user, company } = check.person;
  const parsed = z.tuple([z.string().max(500), z.string().max(100), z.string().min(1).max(200).nullable()]).safeParse([name, timezone, regionId]);
  if (!parsed.success) return { status: "refused", message: "Give the store a name and choose its time zone." };

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { status: "refused", message: "Sign in again to add a store." };

  const outcome = await addCompanyStore(
    { name: parsed.data[0], timezone: parsed.data[1], regionId: parsed.data[2] },
    { userId: user.id, name: user.name, companyId: company.id },
    // keepCurrentActiveOrganization: the call must not move the session's store; setActiveStore does, after the check.
    (storeName, slug) => auth.api.createOrganization({ body: { name: storeName, slug, keepCurrentActiveOrganization: true }, headers: requestHeaders }),
  );
  switch (outcome.status) {
    case "added": {
      // The store exists either way; the next request picks a store from the remembered one.
      const switched = await setActiveStore(session.session.id, user.id, outcome.storeId).catch((error: unknown) => ({ status: error }));
      if (switched.status !== "switched") console.error("add-company-store: active store not set", outcome.storeId, switched.status);
      revalidatePath("/", "layout");
      return { status: "added", storeId: outcome.storeId, activeSet: switched.status === "switched" };
    }
    case "invalid-name":
      return { status: "refused", message: "Give the store a name of 2 to 60 characters." };
    case "invalid-zone":
      return { status: "refused", message: "Choose the store's time zone from the list." };
    case "invalid-region":
      return { status: "refused", message: "That region is out of date. Reload the page and try again." };
    case "failed":
      return { status: "refused", message: "Could not add the store. Try again." };
  }
}
