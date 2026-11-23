"use server";

// Asking for a company and withdrawing the ask (spec 0.7.1 5.1). Any signed-in account may, and the people who
// ask are mostly the ones with no store, so there is no switch to hold (app/server-actions-guard.test.ts says
// why). The person is always the session's; of the browser only the name and a request id are read.

import { sendRequest, type SendOutcome, withdrawRequest, type WithdrawOutcome } from "@/lib/companies/request";
import { requireSignedIn } from "@/lib/current-member";

export async function sendCompanyRequestAction(name: unknown): Promise<SendOutcome> {
  const current = await requireSignedIn();
  return sendRequest(current.user.id, name);
}

export async function withdrawCompanyRequestAction(id: unknown): Promise<WithdrawOutcome> {
  const current = await requireSignedIn();
  if (typeof id !== "string" || id === "" || id.length > 100) return { status: "gone" };
  return withdrawRequest(current.user.id, id);
}
