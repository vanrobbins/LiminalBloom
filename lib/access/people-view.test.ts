import { describe, expect, it } from "vitest";

import { groupByRole, NO_ROLE_NAME, NO_ROLE_RANK, type PersonRow } from "./people-view";

const row = (name: string, roleId: string | null, rank: number): PersonRow => ({
  memberId: `m-${name}`,
  name,
  email: null,
  roleId,
  roleName: roleId ?? NO_ROLE_NAME,
  rank,
  isYou: false,
  canAct: false,
});

describe("groupByRole", () => {
  it("puts the highest rank first and people A to Z (numbers in order) inside a role", () => {
    const groups = groupByRole([row("Zed", "assoc", 500), row("Rack 10", "mgr", 100), row("Rack 2", "mgr", 100), row("Amy", "assoc", 500), row("Mid", "vmw", 400)]);
    expect(groups.map((g) => g.key)).toEqual(["mgr", "vmw", "assoc"]);
    expect(groups[0].people.map((p) => p.name)).toEqual(["Rack 2", "Rack 10"]);
    expect(groups[2].people.map((p) => p.name)).toEqual(["Amy", "Zed"]);
  });

  it("leaves out roles nobody holds, and puts people with no role last", () => {
    const groups = groupByRole([row("Lone", null, NO_ROLE_RANK), row("Boss", "mgr", 100)]);
    expect(groups.map((g) => g.roleName)).toEqual(["mgr", NO_ROLE_NAME]);
  });

  it("is empty for nobody", () => {
    expect(groupByRole([])).toEqual([]);
  });
});
