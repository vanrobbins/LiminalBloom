"use server";

// Help for anyone with an account (spec 0.7.1 9.2, 9.3): a person with no store needs these too, so they hold
// requireSignedIn rather than a store switch (app/server-actions-guard.test.ts says why). The person is always
// the session's. The context is built here from who the session says they are; of the form only `kind`, `body`
// and `from` are read, and `from` only if it is on the whitelist.

import { requireSignedIn } from "@/lib/current-member";
import { buildContext } from "@/lib/help/context";
import type { HelpOutcome } from "@/lib/help/limits";
import { closeRequest, markSeen, openRequest, replyTo } from "@/lib/help/write";

type Field = Record<string, unknown>;
const fieldsOf = (input: unknown): Field => (typeof input === "object" && input !== null ? (input as Field) : {});

export async function openHelpAction(input: unknown): Promise<HelpOutcome> {
  const current = await requireSignedIn();
  const { kind, body, from } = fieldsOf(input);
  return openRequest({ id: current.user.id, name: current.user.name }, { kind, body, context: buildContext(current, from) });
}

export async function replyHelpAction(id: unknown, body: unknown): Promise<HelpOutcome> {
  const current = await requireSignedIn();
  return replyTo({ id: current.user.id, name: current.user.name }, id, body);
}

export async function closeHelpAction(id: unknown): Promise<HelpOutcome> {
  const current = await requireSignedIn();
  return closeRequest(current.user.id, id);
}

export async function markSeenAction(id: unknown): Promise<void> {
  const current = await requireSignedIn();
  await markSeen(current.user.id, id);
}
