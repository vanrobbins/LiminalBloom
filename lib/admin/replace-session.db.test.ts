// The stale session a passkey step-up leaves behind is deleted, and nothing else is (review LOW 8).

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { session } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { dropAccounts, makeAccount, signInAgain } from "@/lib/two-factor/test-accounts";

import { dropReplacedSession } from "./replace-session";

afterAll(dropAccounts);

const sidOf = async (cookie: Headers) => (await auth.api.getSession({ headers: cookie }))!.session.id;
const alive = async (id: string) => (await db.select().from(session).where(eq(session.id, id))).length === 1;
const setProof = (id: string, at: Date | null) => db.update(session).set({ twoFactorAt: at }).where(eq(session.id, id));

describe("dropReplacedSession", () => {
  it("deletes the old stale session once the new one is fresh, and keeps the new one", async () => {
    const a = await makeAccount();
    const oldId = await sidOf(a.cookie);
    const next = await signInAgain(a.email);
    const newId = await sidOf(next);
    await setProof(newId, new Date());
    expect(await dropReplacedSession(next, oldId)).toBe(true);
    expect(await alive(oldId)).toBe(false);
    expect(await alive(newId)).toBe(true);
  });

  it("does nothing when the calling session is not fresh, is the same one, or the old one is fresh itself", async () => {
    const a = await makeAccount();
    const oldId = await sidOf(a.cookie);
    const next = await signInAgain(a.email);
    const newId = await sidOf(next);
    expect(await dropReplacedSession(next, oldId)).toBe(false);
    await setProof(newId, new Date());
    expect(await dropReplacedSession(next, newId)).toBe(false);
    await setProof(oldId, new Date());
    expect(await dropReplacedSession(next, oldId)).toBe(false);
    expect(await alive(oldId)).toBe(true);
    expect(await alive(newId)).toBe(true);
  });

  it("never deletes another account's session", async () => {
    const a = await makeAccount();
    const b = await makeAccount();
    const bId = await sidOf(b.cookie);
    await setProof(await sidOf(a.cookie), new Date());
    expect(await dropReplacedSession(a.cookie, bId)).toBe(false);
    expect(await alive(bId)).toBe(true);
  });
});
