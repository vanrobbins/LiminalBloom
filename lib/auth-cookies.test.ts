import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));

import { applyAuthCookies } from "./auth-cookies";

beforeEach(() => vi.clearAllMocks());

describe("applyAuthCookies", () => {
  it("sets each cookie of the response with its value and attributes", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=abc.def; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax");
    headers.append("set-cookie", "better-auth.dont_remember=true; Path=/; HttpOnly; SameSite=Lax");
    await applyAuthCookies(headers);
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set).toHaveBeenCalledWith("better-auth.session_token", "abc.def", expect.objectContaining({ maxAge: 604800, path: "/", httpOnly: true, sameSite: "lax" }));
    expect(mocks.set).toHaveBeenCalledWith("better-auth.dont_remember", "true", expect.objectContaining({ path: "/", httpOnly: true }));
  });

  it("sets nothing when the response set no cookie", async () => {
    await applyAuthCookies(new Headers());
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
