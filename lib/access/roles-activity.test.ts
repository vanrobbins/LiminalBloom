import { describe, expect, it } from "vitest";

import { activityText } from "./roles-activity";

describe("activityText", () => {
  const line = (event: string, detail: Record<string, unknown>, emails = true) => activityText(event, "Van Robbins", detail, emails);

  it("reads each role event as a sentence", () => {
    expect(line("role_created", { role: "Educator" })).toBe("Van Robbins added the role Educator");
    expect(line("role_two_factor_changed", { role: "Educator", on: true })).toBe("Van Robbins made Educator require two-factor sign-in");
    expect(line("role_two_factor_changed", { role: "Educator", on: false })).toBe("Van Robbins stopped Educator requiring two-factor sign-in");
    expect(line("role_renamed", { from: "Sales Associate", to: "Educator" })).toBe("Van Robbins renamed Sales Associate to Educator");
    expect(line("role_reordered", { role: "Educator", past: "Sales Associate", direction: "up" })).toBe("Van Robbins moved Educator above Sales Associate");
    expect(line("role_reordered", { role: "Educator", past: "Sales Associate", direction: "down" })).toBe("Van Robbins moved Educator below Sales Associate");
    expect(line("role_reset", { role: "Visual Merchandising Worker" })).toBe("Van Robbins reset Visual Merchandising Worker to its default");
    expect(line("role_deleted", { role: "Educator", movedTo: "Sales Associate", people: 3 })).toBe("Van Robbins deleted Educator and moved 3 people to Sales Associate");
    expect(line("role_deleted", { role: "Educator", people: 1, movedTo: "Sales Associate" })).toContain("moved 1 person to");
    expect(line("role_deleted", { role: "Educator", people: 0 })).toBe("Van Robbins deleted Educator");
  });

  it("names the permissions turned on and off by their labels", () => {
    expect(line("role_switches_changed", { role: "Educator", added: ["products.sale"], removed: ["products.stock"] })).toBe("Van Robbins changed Educator: turned on Run sales; turned off Mark sold out");
    expect(line("role_switches_changed", { role: "Educator", added: [], removed: ["products.stock", "not.a.switch"] })).toBe("Van Robbins changed Educator: turned off Mark sold out");
    expect(line("role_switches_changed", { role: "Educator" })).toBe("Van Robbins changed Educator");
  });

  it("reads the people events", () => {
    expect(line("member_role_changed", { person: "Jane Park", from: "Sales Associate", to: "Visual Merchandising Worker" })).toBe("Van Robbins changed Jane Park from Sales Associate to Visual Merchandising Worker");
    expect(line("member_removed", { person: "Jane Park" })).toBe("Van Robbins removed Jane Park");
    expect(line("invitation_accepted", { role: "Sales Associate" })).toBe("Van Robbins joined as Sales Associate");
    expect(line("store_renamed", { from: "Pioneer Place", to: "Riverside" })).toBe("Van Robbins renamed the store from Pioneer Place to Riverside");
  });

  it("shows an invitation's email only to someone who may manage people", () => {
    const detail = { email: "jane@x.com", role: "Sales Associate" };
    expect(line("invitation_created", detail)).toBe("Van Robbins invited jane@x.com as Sales Associate");
    expect(line("invitation_cancelled", detail)).toBe("Van Robbins cancelled the invitation for jane@x.com");
    for (const event of ["invitation_created", "invitation_cancelled"]) expect(line(event, detail, false)).not.toContain("jane@x.com");
    expect(line("invitation_created", detail, false)).toBe("Van Robbins created an invitation as Sales Associate");
    expect(line("invitation_cancelled", detail, false)).toBe("Van Robbins cancelled an invitation");
  });

  it("says 'made a change' for an event it doesn't know, and survives a detail of the wrong shape", () => {
    expect(line("role_teleported", { role: "Educator" })).toBe("Van Robbins made a change");
    expect(line("role_renamed", { from: 1, to: null })).toBe("Van Robbins renamed a role to a new name");
    expect(line("role_switches_changed", { role: "Educator", added: "products.sale" })).toBe("Van Robbins changed Educator");
  });
});
