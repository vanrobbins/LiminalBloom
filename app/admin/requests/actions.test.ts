// The admin company-request actions as entry points (spec 0.7.1 5.3, 7.2): each awaits the admin guard before
// anything else, does nothing for a caller the guard refuses, needs a clean reason and clean ids, passes the
// guard's own admin as the actor (never anything from the browser), and returns only a status. The work is
// proved in lib/companies/*.db.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), approve: vi.fn(), reject: vi.fn(), ask: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdminForAction: mocks.guard }));
vi.mock("@/lib/companies/approve", () => ({ approveRequest: mocks.approve }));
vi.mock("@/lib/companies/reject", () => ({ rejectRequest: mocks.reject }));
vi.mock("@/lib/companies/request-ask", () => ({ askAboutRequest: mocks.ask }));

import { approveRequestAction, askQuestionAction, rejectRequestAction } from "./actions";

const ADMIN = { userId: "admin-1", name: "Ada Admin", email: "ada@example.com", sessionId: "s", twoFactorEnabled: true, passkey: false, twoFactorAt: new Date() };
const ACTOR = { userId: "admin-1", name: "Ada Admin" };
const REASON = "Verified by phone";

const DECIDE: [string, (id: unknown, version: unknown, reason: unknown) => Promise<{ status: string }>, ReturnType<typeof vi.fn>][] = [
  ["approveRequestAction", approveRequestAction, mocks.approve],
  ["rejectRequestAction", rejectRequestAction, mocks.reject],
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ status: "ok", admin: ADMIN });
  for (const fn of [mocks.approve, mocks.reject, mocks.ask]) fn.mockResolvedValue({ status: "done" });
});

describe.each(DECIDE)("%s", (_name, call, fn) => {
  it("does nothing when the guard says forbidden", async () => {
    mocks.guard.mockResolvedValue({ status: "forbidden" });
    expect(await call("r1", 1, REASON)).toEqual({ status: "forbidden" });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "four", "x".repeat(501), 42])("refuses the reason %j before anything is written", async (reason) => {
    expect(await call("r1", 1, reason)).toEqual({ status: "invalid-reason" });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([undefined, "", 7, {}, "x".repeat(201)])("an id of %j is invalid, not passed on", async (id) => {
    expect(await call(id, 1, REASON)).toEqual({ status: "invalid" });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([undefined, 0, -1, 1.5, "1", Number.NaN])("a version of %j is invalid, not passed on", async (version) => {
    expect(await call("r1", version, REASON)).toEqual({ status: "invalid" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("passes the guard's admin, the id, the version the admin saw and the trimmed reason, and returns only the status", async () => {
    fn.mockResolvedValue({ status: "done", companyId: "c1", name: "Acme" });
    expect(await call("r1", 3, `  ${REASON}  `)).toEqual({ status: "done" });
    expect(fn).toHaveBeenCalledWith(ACTOR, { id: "r1", version: 3 }, REASON);
  });

  it("passes a refusal on as its status", async () => {
    fn.mockResolvedValue({ status: "already" });
    expect(await call("r1", 3, REASON)).toEqual({ status: "already" });
  });
});

describe("approveRequestAction", () => {
  it("says owner and slug-taken as they are, with no company name crossing", async () => {
    mocks.approve.mockResolvedValue({ status: "owner", companyName: "Secret Co" });
    expect(await approveRequestAction("r1", 1, REASON)).toEqual({ status: "owner" });
    mocks.approve.mockResolvedValue({ status: "slug-taken" });
    expect(await approveRequestAction("r1", 1, REASON)).toEqual({ status: "slug-taken" });
  });
});

describe("askQuestionAction", () => {
  it("does nothing when the guard says forbidden", async () => {
    mocks.guard.mockResolvedValue({ status: "forbidden" });
    expect(await askQuestionAction("r1", "Which stores?")).toEqual({ status: "forbidden" });
    expect(mocks.ask).not.toHaveBeenCalled();
  });

  it.each([undefined, "", 7, "x".repeat(201)])("an id of %j is invalid", async (id) => {
    expect(await askQuestionAction(id, "Which stores?")).toEqual({ status: "invalid" });
    expect(mocks.ask).not.toHaveBeenCalled();
  });

  it("passes the guard's admin and the text as sent (the library cleans it), and returns only the status", async () => {
    mocks.ask.mockResolvedValue({ status: "not-pending" });
    expect(await askQuestionAction("r1", "Which stores?")).toEqual({ status: "not-pending" });
    expect(mocks.ask).toHaveBeenCalledWith(ACTOR, "r1", "Which stores?");
  });
});
