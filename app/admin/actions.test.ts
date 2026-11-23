// The admin help actions as entry points (spec 0.7.1 7.2, 7.4): every one awaits the admin guard before anything
// else, does nothing for a caller the guard refuses, needs a clean reason and clean ids, and passes the guard's own
// admin (never anything from the browser) as the actor. The work is proved in lib/admin/*.db.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  core: { signOutEverywhere: vi.fn(), cancelStoreInvitation: vi.fn(), makeStoreManager: vi.fn() },
  pause: { pauseStore: vi.fn(), restoreStore: vi.fn() },
  reset: { resetAccountTwoFactor: vi.fn() },
  admins: { addAdmin: vi.fn(), removeAdmin: vi.fn() },
}));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdminForAction: mocks.guard }));
vi.mock("@/lib/admin/actions-core", () => mocks.core);
vi.mock("@/lib/admin/actions-pause", () => mocks.pause);
vi.mock("@/lib/admin/actions-two-factor", () => mocks.reset);
vi.mock("@/lib/admin/admins", () => mocks.admins);

import { addAdminAction, removeAdminAction } from "./admins/actions";
import { cancelInvitationAction, resetTwoFactorAction, signOutEverywhereAction } from "./people/actions";
import { makeStoreManagerAction, pauseStoreAction, restoreStoreAction } from "./stores/actions";

const ADMIN = { userId: "admin-1", name: "Ada Admin", email: "ada@example.com", sessionId: "s", twoFactorEnabled: true, passkey: false, twoFactorAt: new Date() };
const ACTOR = { userId: "admin-1", name: "Ada Admin" };
const REASON = "Owner asked by phone";

// Each action: how to call it with an id (and an email for Add), and the library function it ends in.
const CASES: [string, (id: unknown, reason: unknown) => Promise<{ status: string }>, ReturnType<typeof vi.fn>][] = [
  ["signOutEverywhereAction", (id, r) => signOutEverywhereAction(id, r), mocks.core.signOutEverywhere],
  ["cancelInvitationAction", (id, r) => cancelInvitationAction(id, r), mocks.core.cancelStoreInvitation],
  ["resetTwoFactorAction", (id, r) => resetTwoFactorAction(id, r), mocks.reset.resetAccountTwoFactor],
  ["pauseStoreAction", (id, r) => pauseStoreAction(id, r), mocks.pause.pauseStore],
  ["restoreStoreAction", (id, r) => restoreStoreAction(id, r), mocks.pause.restoreStore],
  ["makeStoreManagerAction", (id, r) => makeStoreManagerAction(id, "user-1", r), mocks.core.makeStoreManager],
  ["addAdminAction", (id, r) => addAdminAction(id === "target" ? "new@example.com" : id, r), mocks.admins.addAdmin],
  ["removeAdminAction", (id, r) => removeAdminAction(id, r), mocks.admins.removeAdmin],
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ status: "ok", admin: ADMIN });
  for (const [, , fn] of CASES) fn.mockResolvedValue({ status: "done" });
});

describe.each(CASES)("%s", (_name, call, fn) => {
  it("does nothing when the guard says forbidden", async () => {
    mocks.guard.mockResolvedValue({ status: "forbidden" });
    expect(await call("target", REASON)).toEqual({ status: "forbidden" });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "four", "x".repeat(501), 42])("refuses the reason %j before anything is written", async (reason) => {
    expect(await call("target", reason)).toEqual({ status: "invalid-reason" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("passes the guard's admin as the actor and the trimmed reason, and returns only the status", async () => {
    mocks.guard.mockResolvedValue({ status: "ok", admin: ADMIN });
    fn.mockResolvedValue({ status: "done", email: "private@example.com", sessions: 3 });
    const reply = await call("target", `  ${REASON}  `);
    expect(fn.mock.calls[0][0]).toEqual(ACTOR);
    expect(fn.mock.calls[0]).toContain(REASON);
    expect(reply).toEqual({ status: "done" });
  });
});

describe("input ids", () => {
  it.each([undefined, "", 7, {}, "x".repeat(201)])("an id of %j is invalid, not passed on", async (id) => {
    expect(await signOutEverywhereAction(id, REASON)).toEqual({ status: "invalid" });
    expect(await pauseStoreAction(id, REASON)).toEqual({ status: "invalid" });
    expect(await removeAdminAction(id, REASON)).toEqual({ status: "invalid" });
    expect(await makeStoreManagerAction("s1", id, REASON)).toEqual({ status: "invalid" });
    expect(mocks.core.signOutEverywhere).not.toHaveBeenCalled();
    expect(mocks.pause.pauseStore).not.toHaveBeenCalled();
  });

  it("an email that is not text is answered as no account", async () => {
    expect(await addAdminAction(undefined, REASON)).toEqual({ status: "no-account" });
    expect(await addAdminAction("a".repeat(300), REASON)).toEqual({ status: "no-account" });
    expect(mocks.admins.addAdmin).not.toHaveBeenCalled();
  });
});
