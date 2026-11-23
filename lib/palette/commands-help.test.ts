// Help for everyone, the admin area for Liminal Bloom admins only (spec 0.7.1 9.5, 12).

import { describe, expect, it } from "vitest";

import { commandsFor } from "./commands";

const labels = (admin?: boolean) => commandsFor({ switches: ["view"] }, [], "s1", "light", admin).map((c) => c.label);

describe("commandsFor: Help and Liminal Bloom admin", () => {
  it("offers Help to everyone, going to /help, even with only the view switch", () => {
    const help = commandsFor({ switches: ["view"] }, [], "s1", "light").find((c) => c.label === "Help");
    expect(help).toMatchObject({ kind: "page", target: { href: "/help" } });
  });

  it("offers Liminal Bloom admin only to an admin", () => {
    expect(labels(false)).not.toContain("Liminal Bloom admin");
    expect(labels()).not.toContain("Liminal Bloom admin");
    const admin = commandsFor({ switches: ["view"] }, [], "s1", "light", true).find((c) => c.label === "Liminal Bloom admin");
    expect(admin).toMatchObject({ kind: "page", target: { href: "/admin" } });
  });
});
