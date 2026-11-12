import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseInviteLink } from "./invite-link";

const ID = "Zk3p-_Q9aB2cD4eF5gH6iJ7kL8mN0oPq";
const idChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const anId = fc.array(fc.constantFrom(...idChars), { minLength: 1, maxLength: 200 }).map((c) => c.join(""));
const aHost = fc.domain();

describe("parseInviteLink", () => {
  it("takes a bare id, with or without whitespace around it", () => {
    expect(parseInviteLink(ID)).toBe(ID);
    expect(parseInviteLink(`  ${ID}\n`)).toBe(ID);
    expect(parseInviteLink("0b6e3c1a-5d2f-4e8a-9c7b-1a2b3c4d5e6f")).toBe("0b6e3c1a-5d2f-4e8a-9c7b-1a2b3c4d5e6f");
  });

  it.each([
    `https://liminal-bloom.vercel.app/invite/${ID}`,
    `http://localhost:3000/invite/${ID}`,
    `https://example.test/invite/${ID}/`,
    `https://example.test/invite/${ID}?utm=x#top`,
    `HTTPS://Example.Test/invite/${ID}`,
    `  https://example.test/invite/${ID}  `,
    `example.test/invite/${ID}`,
    `localhost:3000/invite/${ID}`,
    `/invite/${ID}`,
  ])("finds the id in %s", (pasted) => {
    expect(parseInviteLink(pasted)).toBe(ID);
  });

  it.each([
    "",
    "   ",
    "hello there",
    "https://example.test/",
    "https://example.test/products",
    `https://example.test/invitation/${ID}`,
    `https://example.test/invite/${ID}/extra`,
    `https://example.test/invite/`,
    `https://example.test/invite/${"a".repeat(201)}`,
    "a".repeat(201),
    `ftp://example.test/invite/${ID}`,
    "javascript:alert(1)",
    `https://example.test/invite/${ID} and more`,
    `https://example.test/invite/${ID}%2F..`,
    "https://",
  ])("refuses %j", (pasted) => {
    expect(parseInviteLink(pasted)).toBeNull();
  });

  it("round-trips any id through a bare paste and through a link on any host", () => {
    fc.assert(
      fc.property(anId, aHost, fc.constantFrom("http", "https"), fc.constantFrom("", "/", "?next=%2Fproducts", "#x"), (id, host, scheme, tail) => {
        expect(parseInviteLink(id)).toBe(id);
        expect(parseInviteLink(`${scheme}://${host}/invite/${id}${tail}`)).toBe(id);
      }),
    );
  });

  it("never throws, and only ever returns something the invitation page would take as an id", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (pasted) => {
        const found = parseInviteLink(pasted);
        expect(found === null || /^[A-Za-z0-9_-]{1,200}$/.test(found)).toBe(true);
      }),
    );
  });
});
