// The help actions (spec 0.7.1 9.2): the context is the server's, never the form's, and only the fields an
// action names are read from what the browser sends.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSignedIn: vi.fn(),
  openRequest: vi.fn(),
  replyTo: vi.fn(),
  closeRequest: vi.fn(),
  markSeen: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/current-member", () => ({ requireSignedIn: mocks.requireSignedIn }));
vi.mock("@/lib/help/write", () => ({ openRequest: mocks.openRequest, replyTo: mocks.replyTo, closeRequest: mocks.closeRequest, markSeen: mocks.markSeen }));

import { closeHelpAction, markSeenAction, openHelpAction, replyHelpAction } from "./actions";

const USER = { id: "u1", name: "Van", email: "van@example.com" };
const MEMBER = { kind: "member", user: USER, stores: [{ id: "s1", name: "Pioneer Place" }], activeStoreId: "s1", role: { id: "r", name: "Sales Associate", rank: 500 }, switches: [], isPlatformAdmin: false, helpReplies: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSignedIn.mockResolvedValue(MEMBER);
  mocks.openRequest.mockResolvedValue({ status: "done", id: "abc" });
  mocks.replyTo.mockResolvedValue({ status: "done" });
  mocks.closeRequest.mockResolvedValue({ status: "done" });
});

describe("openHelpAction", () => {
  it("builds the context on the server: what the form claims about the store, role or account is ignored", async () => {
    const forged = { kind: "account", body: "I cannot see my store", from: "/paused", context: { store: { name: "Forged" } }, store: "Forged", role: "Owner", requesterId: "someone-else", status: "closed" };
    expect(await openHelpAction(forged)).toEqual({ status: "done", id: "abc" });
    expect(mocks.openRequest).toHaveBeenCalledTimes(1);
    const [who, input] = mocks.openRequest.mock.calls[0];
    expect(who).toEqual({ id: "u1", name: "Van" });
    expect(input).toEqual({ kind: "account", body: "I cannot see my store", context: { state: "member", store: { id: "s1", name: "Pioneer Place" }, role: "Sales Associate", from: "/paused" } });
    expect(JSON.stringify(input)).not.toContain("Forged");
  });

  it("drops a from that is not on the list, and a body that is not text is passed on to be refused", async () => {
    await openHelpAction({ kind: "other", body: 42, from: "/admin" });
    const [, input] = mocks.openRequest.mock.calls[0];
    expect(input.context).not.toHaveProperty("from");
    expect(input.body).toBe(42);
  });

  it("works for a person with no store, whose context says so", async () => {
    mocks.requireSignedIn.mockResolvedValue({ kind: "no-store", user: USER });
    await openHelpAction({ kind: "account", body: "Where is my invitation?", from: "/welcome" });
    expect(mocks.openRequest.mock.calls[0][1].context).toEqual({ state: "no-store", from: "/welcome" });
  });

  it("tolerates a missing or odd input without throwing", async () => {
    for (const input of [undefined, null, "text", 5]) {
      await openHelpAction(input);
    }
    expect(mocks.openRequest).toHaveBeenCalledTimes(4);
  });

  it("answers only the status and the new request's id", async () => {
    mocks.openRequest.mockResolvedValue({ status: "too-many-open" });
    expect(await openHelpAction({ kind: "other", body: "Ten characters or more" })).toEqual({ status: "too-many-open" });
  });

  it("sends a signed-out visitor to sign in before anything is written", async () => {
    mocks.requireSignedIn.mockImplementation(async () => mocks.redirect("/sign-in"));
    await expect(openHelpAction({ kind: "other", body: "Ten characters or more" })).rejects.toThrow("redirect:/sign-in");
    expect(mocks.openRequest).not.toHaveBeenCalled();
  });
});

describe("the other actions act for the signed-in person only", () => {
  it("reply, close and seen pass the session's person, never an id from the form", async () => {
    await replyHelpAction("t1", "More detail");
    expect(mocks.replyTo).toHaveBeenCalledWith({ id: "u1", name: "Van" }, "t1", "More detail");
    await closeHelpAction("t1");
    expect(mocks.closeRequest).toHaveBeenCalledWith("u1", "t1");
    await markSeenAction("t1");
    expect(mocks.markSeen).toHaveBeenCalledWith("u1", "t1");
  });

  it("each sends a signed-out visitor away before writing", async () => {
    mocks.requireSignedIn.mockImplementation(async () => mocks.redirect("/sign-in"));
    await expect(replyHelpAction("t1", "x")).rejects.toThrow("redirect:/sign-in");
    await expect(closeHelpAction("t1")).rejects.toThrow("redirect:/sign-in");
    await expect(markSeenAction("t1")).rejects.toThrow("redirect:/sign-in");
    expect(mocks.replyTo).not.toHaveBeenCalled();
    expect(mocks.closeRequest).not.toHaveBeenCalled();
    expect(mocks.markSeen).not.toHaveBeenCalled();
  });
});
