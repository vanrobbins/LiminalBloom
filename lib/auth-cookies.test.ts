import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ set: vi.fn(), options: {} as { advanced?: { cookiePrefix?: string } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("@/lib/auth", () => ({ auth: { options: mocks.options } }));

import { applyAuthCookies } from "./auth-cookies";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.options.advanced = undefined;
});

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

  it("copies a __Secure- cookie with its Secure flag", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "__Secure-better-auth.session_token=abc.def; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax");
    await applyAuthCookies(headers);
    expect(mocks.set).toHaveBeenCalledWith("__Secure-better-auth.session_token", "abc.def", expect.objectContaining({ secure: true, maxAge: 604800 }));
  });

  it("keeps a cookie with no Max-Age or Expires a session cookie", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=abc.def; Path=/; HttpOnly; SameSite=Lax");
    await applyAuthCookies(headers);
    const options = mocks.set.mock.calls[0][2];
    expect(options.maxAge).toBeUndefined();
    expect(options.expires).toBeUndefined();
  });

  it("ignores a cookie that is not Better Auth's, and one whose name only contains its prefix", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "theme=dark; Path=/");
    headers.append("set-cookie", "my-better-auth.session_token=x; Path=/");
    headers.append("set-cookie", "better-auth.session_token=abc.def; Path=/; HttpOnly");
    await applyAuthCookies(headers);
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set.mock.calls[0][0]).toBe("better-auth.session_token");
  });

  it("follows a configured cookie prefix", async () => {
    mocks.options.advanced = { cookiePrefix: "liminal" };
    const headers = new Headers();
    headers.append("set-cookie", "liminal.session_token=a; Path=/");
    headers.append("set-cookie", "__Secure-liminal.session_token=b; Path=/; Secure");
    headers.append("set-cookie", "better-auth.session_token=c; Path=/");
    await applyAuthCookies(headers);
    expect(mocks.set.mock.calls.map((c) => c[0])).toEqual(["liminal.session_token", "__Secure-liminal.session_token"]);
  });
});
