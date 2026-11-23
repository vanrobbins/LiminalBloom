// The sign-in and sign-up pages pass the form a return path only when it stays on
// this site: `?next=` is typed in the address bar, so it is untrusted.

import { describe, expect, it } from "vitest";

import SignInPage from "./sign-in/page";
import TwoFactorPage from "./sign-in/two-factor/page";
import SignUpPage from "./sign-up/page";

const pages = { "sign-in": SignInPage, "sign-in/two-factor": TwoFactorPage, "sign-up": SignUpPage };

describe.each(Object.entries(pages))("%s page", (_name, Page) => {
  const nextOf = async (next: string | string[] | undefined) => (await Page({ searchParams: Promise.resolve({ next }) })).props.next;

  it("passes on a path on this site", async () => {
    expect(await nextOf("/invite/abc123")).toBe("/invite/abc123");
  });

  it("passes on nothing for another site, a protocol-relative address, a repeated value or no value", async () => {
    for (const bad of ["https://evil.example", "//evil.example", ["/a", "/b"], undefined]) expect(await nextOf(bad)).toBeNull();
  });
});
