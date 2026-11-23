// The request actions (spec 0.7.1 5.1): the person is always the session's, the guard comes first, and of the
// browser only the name and a request id are read.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSignedIn: vi.fn(),
  send: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("@/lib/current-member", () => ({ requireSignedIn: mocks.requireSignedIn }));
vi.mock("@/lib/companies/request", () => ({ sendRequest: mocks.send, withdrawRequest: mocks.withdraw }));

import { sendCompanyRequestAction, withdrawCompanyRequestAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSignedIn.mockResolvedValue({ kind: "no-store", user: { id: "u1", name: "Van", email: "van@example.com" } });
  mocks.send.mockResolvedValue({ status: "done", id: "r1" });
  mocks.withdraw.mockResolvedValue({ status: "done" });
});

describe("sendCompanyRequestAction", () => {
  it("sends for the session's person, whatever the form claims, and passes the name on to be cleaned", async () => {
    expect(await sendCompanyRequestAction("  Acme  ")).toEqual({ status: "done", id: "r1" });
    expect(mocks.send).toHaveBeenCalledWith("u1", "  Acme  ");
  });

  it("sends nothing for a signed-out visitor: the guard redirects first", async () => {
    mocks.requireSignedIn.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(sendCompanyRequestAction("Acme")).rejects.toThrow("redirect:/sign-in");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("passes a refusal on as it is", async () => {
    mocks.send.mockResolvedValue({ status: "owner" });
    expect(await sendCompanyRequestAction("Acme")).toEqual({ status: "owner" });
  });
});

describe("withdrawCompanyRequestAction", () => {
  it("withdraws the session person's request by its id", async () => {
    expect(await withdrawCompanyRequestAction("r1")).toEqual({ status: "done" });
    expect(mocks.withdraw).toHaveBeenCalledWith("u1", "r1");
  });

  it.each([undefined, "", 7, {}, "x".repeat(101)])("an id of %j is gone, not passed on", async (id) => {
    expect(await withdrawCompanyRequestAction(id)).toEqual({ status: "gone" });
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it("does nothing for a signed-out visitor", async () => {
    mocks.requireSignedIn.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(withdrawCompanyRequestAction("r1")).rejects.toThrow("redirect:/sign-in");
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });
});
