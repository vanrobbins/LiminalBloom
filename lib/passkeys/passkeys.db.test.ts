// Passkeys on Account against the development database (spec 0.7.1 8.4, A3c): the list with last used,
// rename, and removal (the password, and the last passkey kept while the account needs two-factor).

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { member, user } from "@/db/auth-schema";
import { platformAdmins } from "@/db/schema";
import { dropPeople, makeStoreWithRoles } from "@/lib/access/test-roles";
import { clearWrongGuesses } from "@/lib/password-guesses";
import { dropStores } from "@/lib/products/test-stores";
import { dropAccounts, makeAccount, TEST_PASSWORD } from "@/lib/two-factor/test-accounts";

import { removePasskey, renamePasskey } from "./change";
import { hasPasskey, listPasskeys, recordPasskeyUse } from "./list";
import { addPasskeyRow } from "./test-passkeys";

afterAll(async () => {
  await dropAccounts();
  await dropStores();
  await dropPeople();
});

describe("listPasskeys and recordPasskeyUse", () => {
  it("lists the account's own passkeys oldest first, with last used empty until one signs in", async () => {
    const a = await makeAccount();
    const other = await makeAccount();
    const first = await addPasskeyRow(a.userId, "Laptop", new Date(Date.now() - 60_000));
    const second = await addPasskeyRow(a.userId, null);
    await addPasskeyRow(other.userId, "Not mine");
    const rows = await listPasskeys(a.userId);
    expect(rows.map((r) => r.id)).toEqual([first.id, second.id]);
    expect(rows[0]).toMatchObject({ name: "Laptop", lastUsedAt: null });
    await recordPasskeyUse(first.credentialID);
    const after = await listPasskeys(a.userId);
    expect(after[0].lastUsedAt).toBeInstanceOf(Date);
    expect(after[1].lastUsedAt).toBeNull();
    expect(await hasPasskey(a.userId)).toBe(true);
    expect(await hasPasskey((await makeAccount()).userId)).toBe(false);
  });

  it("an unknown credential is ignored, and a second use moves the time on", async () => {
    const a = await makeAccount();
    const key = await addPasskeyRow(a.userId);
    await recordPasskeyUse("no-such-credential");
    await recordPasskeyUse(key.credentialID);
    const [one] = await listPasskeys(a.userId);
    await new Promise((r) => setTimeout(r, 20));
    await recordPasskeyUse(key.credentialID);
    const [two] = await listPasskeys(a.userId);
    expect(two.lastUsedAt!.getTime()).toBeGreaterThan(one.lastUsedAt!.getTime());
  });
});

describe("renamePasskey", () => {
  it("renames one's own, trimmed, and refuses an empty, a long or someone else's", async () => {
    const a = await makeAccount();
    const b = await makeAccount();
    const key = await addPasskeyRow(a.userId, "Old");
    expect(await renamePasskey(a.userId, key.id, "  Work phone ")).toEqual({ status: "ok" });
    expect((await listPasskeys(a.userId))[0].name).toBe("Work phone");
    expect(await renamePasskey(a.userId, key.id, "   ")).toEqual({ status: "refused", reason: "name" });
    expect(await renamePasskey(a.userId, key.id, "x".repeat(61))).toEqual({ status: "refused", reason: "name" });
    expect(await renamePasskey(b.userId, key.id, "Mine now")).toEqual({ status: "refused", reason: "missing" });
    expect((await listPasskeys(a.userId))[0].name).toBe("Work phone");
  });
});

describe("removePasskey", () => {
  it("needs the right password; a wrong one is refused and counted, and the passkey stays", async () => {
    const a = await makeAccount();
    const key = await addPasskeyRow(a.userId);
    expect(await removePasskey(a.cookie, a.userId, key.id, "not-the-password-1")).toEqual({ status: "refused", reason: "password" });
    expect(await listPasskeys(a.userId)).toHaveLength(1);
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toEqual({ status: "ok" });
    expect(await listPasskeys(a.userId)).toHaveLength(0);
    await clearWrongGuesses(a.userId);
  });

  it("five wrong passwords lock the next try, even a right one", async () => {
    const a = await makeAccount();
    const key = await addPasskeyRow(a.userId);
    for (let i = 0; i < 5; i++) await removePasskey(a.cookie, a.userId, key.id, "not-the-password-1");
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toEqual({ status: "refused", reason: "locked" });
    expect(await listPasskeys(a.userId)).toHaveLength(1);
    await clearWrongGuesses(a.userId);
  });

  it("will not remove someone else's passkey", async () => {
    const a = await makeAccount();
    const b = await makeAccount();
    const key = await addPasskeyRow(b.userId);
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toEqual({ status: "refused", reason: "missing" });
    expect(await listPasskeys(b.userId)).toHaveLength(1);
    await clearWrongGuesses(a.userId);
  });

  it("refuses the last passkey of a Liminal Bloom admin with no authenticator app, and allows it with another passkey or the app", async () => {
    const a = await makeAccount();
    await db.insert(platformAdmins).values({ userId: a.userId, addedByName: "Test" });
    const one = await addPasskeyRow(a.userId, "One");
    expect(await removePasskey(a.cookie, a.userId, one.id, TEST_PASSWORD)).toEqual({ status: "refused", reason: "last" });
    expect(await listPasskeys(a.userId)).toHaveLength(1);
    // A second passkey makes the first removable.
    const two = await addPasskeyRow(a.userId, "Two");
    expect(await removePasskey(a.cookie, a.userId, one.id, TEST_PASSWORD)).toEqual({ status: "ok" });
    expect(await removePasskey(a.cookie, a.userId, two.id, TEST_PASSWORD)).toEqual({ status: "refused", reason: "last" });
    // With the authenticator app on, the last passkey can go.
    await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, a.userId));
    expect(await removePasskey(a.cookie, a.userId, two.id, TEST_PASSWORD)).toEqual({ status: "ok" });
    await clearWrongGuesses(a.userId);
  });

  it("refuses the last passkey when the person's role requires two-factor, naming the store", async () => {
    const a = await makeAccount();
    const { store, roles } = await makeStoreWithRoles("passkey-required");
    await db.insert(member).values({ id: `m-${a.userId}`, organizationId: store, userId: a.userId, role: "member", roleId: roles.store_manager, createdAt: new Date() });
    const key = await addPasskeyRow(a.userId);
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toMatchObject({ status: "refused", reason: "last", store: expect.stringContaining("passkey-required") });
    await db.update(member).set({ roleId: roles.vm_worker }).where(eq(member.userId, a.userId));
    expect(await removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD)).toEqual({ status: "ok" });
    await clearWrongGuesses(a.userId);
  });

  it("two removals at once cannot take the last two passkeys of an admin with no app: one stays", async () => {
    const people = await Promise.all(Array.from({ length: 4 }, () => makeAccount()));
    const pairs = await Promise.all(
      people.map(async (a) => {
        await db.insert(platformAdmins).values({ userId: a.userId, addedByName: "Test" });
        return { a, keys: [await addPasskeyRow(a.userId, "One"), await addPasskeyRow(a.userId, "Two")] };
      }),
    );
    const replies = await Promise.all(pairs.flatMap(({ a, keys }) => keys.map((key) => removePasskey(a.cookie, a.userId, key.id, TEST_PASSWORD))));
    for (const { a } of pairs) expect(await listPasskeys(a.userId), a.userId).toHaveLength(1);
    expect(replies.filter((r) => r.status === "ok")).toHaveLength(4);
    expect(replies.filter((r) => r.status === "refused" && r.reason === "last")).toHaveLength(4);
    await Promise.all(people.map((a) => clearWrongGuesses(a.userId)));
  });
});
