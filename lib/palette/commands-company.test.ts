// Company for company people only (spec 0.7.1 11).

import { describe, expect, it } from "vitest";

import { commandsFor } from "./commands";

describe("commandsFor: Company", () => {
  it("offers Company to a company person, going to /company, even with only the view switch", () => {
    const company = commandsFor({ switches: ["view"] }, [], "s1", "light", false, true).find((c) => c.label === "Company");
    expect(company).toMatchObject({ kind: "page", target: { href: "/company" } });
  });

  it("does not offer it to anyone else", () => {
    expect(commandsFor({ switches: ["view"] }, [], "s1", "light").map((c) => c.label)).not.toContain("Company");
    expect(commandsFor({ switches: ["view"] }, [], "s1", "light", true, false).map((c) => c.label)).not.toContain("Company");
  });
});
